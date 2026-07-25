/**
 * Edge Function: sync-apps
 *
 * Called by the Windows agent every ~60 seconds to report its currently
 * installed / running applications and receive back the latest block rules.
 *
 * Method : POST
 * Auth   : x-device-id + x-device-token headers (agent token, NOT Supabase JWT)
 * Body   :
 *   {
 *     apps: [
 *       { app_name: "Roblox.exe", display_name: "Roblox" },
 *       ...
 *     ]
 *   }
 *
 * Response 200:
 *   {
 *     synced_count: number,
 *     rules: [
 *       {
 *         app_name: string,
 *         app_status: "allowed"|"blocked"|"scheduled",
 *         rule: { rule_type, duration_minutes, schedule_days,
 *                 schedule_start, schedule_end, expires_at } | null
 *       }
 *     ]
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, x-device-id, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Extract and validate agent credentials from custom headers
  const deviceId    = req.headers.get("x-device-id")    ?? "";
  const deviceToken = req.headers.get("x-device-token") ?? "";

  if (!deviceId || !deviceToken) {
    return json({ error: "Missing x-device-id or x-device-token headers" }, 401);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: isValid, error: authError } = await serviceClient
    .rpc("validate_device_token", {
      p_device_id:  deviceId,
      p_raw_token:  deviceToken,
    });

  if (authError || !isValid) {
    return json({ error: "Invalid device credentials" }, 401);
  }

  // 2. Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const incomingApps = Array.isArray(body.apps) ? body.apps : [];

  // Validate each app entry and cap at 500 — a legitimate Windows machine
  // won't have more than a few hundred processes/apps.  This prevents a
  // compromised or buggy agent from performing a mass-insert DoS attack.
  const MAX_APPS = 500;
  const validApps = incomingApps
    .filter((a) => typeof a.app_name === "string" && a.app_name.trim())
    .slice(0, MAX_APPS);

  // 3. Upsert apps (insert new, update last_updated for existing)
  //    We never delete old apps — they remain for historical reference.
  if (validApps.length > 0) {
    const upsertRows = validApps.map((a) => ({
      device_id:    deviceId,
      app_name:     a.app_name.trim(),
      display_name: (a.display_name ?? a.app_name).trim(),
      last_updated: new Date().toISOString(),
      // status intentionally NOT set here — rules control status
    }));

    const { error: upsertError } = await serviceClient
      .from("apps")
      .upsert(upsertRows, {
        onConflict:        "device_id,app_name",
        ignoreDuplicates:  false,     // we want last_updated to refresh
      });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return json({ error: "Failed to sync apps" }, 500);
    }
  }

  // 4. Read the CURRENT last_seen_at BEFORE updating it.
  //    The agent uses this to detect whether it was offline unexpectedly
  //    (tamper signal). We must capture it before the update overwrites it.
  const { data: deviceRow } = await serviceClient
    .from("devices")
    .select("last_seen_at")
    .eq("id", deviceId)
    .single();

  const previousLastSeen = deviceRow?.last_seen_at ?? null;

  // 5. Stamp the device as online with the fresh timestamp
  await serviceClient
    .from("devices")
    .update({ last_seen_at: new Date().toISOString(), status: "connected" })
    .eq("id", deviceId);

  // 6. Return ALL current rules for this device so the agent can enforce them
  const { data: ruleRows, error: rulesError } = await serviceClient
    .from("apps")
    .select(`
      app_name,
      status,
      rules (
        id,
        rule_type,
        duration_minutes,
        schedule_days,
        schedule_start,
        schedule_end,
        expires_at
      )
    `)
    .eq("device_id", deviceId);

  if (rulesError) {
    console.error("Rules fetch error:", rulesError);
    return json({ error: "Failed to fetch rules" }, 500);
  }

  const rules = (ruleRows ?? []).map((row) => ({
    app_name:   row.app_name,
    app_status: row.status,
    rule:       row.rules?.[0] ?? null,   // one active rule per app
  }));

  // Return previous last_seen_at so the agent can compute the offline gap
  // for tamper detection without needing a separate API call.
  return json({
    synced_count:   validApps.length,
    last_seen_at:   previousLastSeen,
    rules,
  });
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
