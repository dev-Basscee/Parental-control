/**
 * Edge Function: report-activity
 *
 * Called by the Windows agent when it enforces or lifts a block on an app.
 * This keeps the parent's Activity Log up to date in real time.
 *
 * Method : POST
 * Auth   : x-device-id + x-device-token headers
 * Body   :
 *   {
 *     app_name:     string,   -- e.g. "Roblox.exe"
 *     action:       string,   -- e.g. "blocked", "unblocked", "app_launched"
 *     triggered_by: string    -- "parent" | "system"  (optional, defaults to "system")
 *   }
 *
 * Response 200: { log_id: string }
 * Response 4xx: { error: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, x-device-id, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ACTIONS = new Set([
  // Block/unblock events from enforcer
  "blocked", "unblocked",
  // App lifecycle events from appScanner
  "app_launched", "app_closed",
  // Device lifecycle events
  "device_connected", "device_disconnected",
  // Rule events
  "limit_reached",
  // Agent startup signals — sent by agent.js on every boot
  // 'after_gap' variant means the agent was offline > 5 min (tamper signal)
  "agent_restarted", "agent_restarted_after_gap",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Authenticate agent
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

  const appName     = (body.app_name ?? "").trim();
  const action      = (body.action ?? "").trim();
  const triggeredBy = ["parent", "system"].includes(body.triggered_by)
                        ? body.triggered_by
                        : "system";

  if (!appName) return json({ error: "app_name is required" }, 400);
  if (!action)  return json({ error: "action is required" }, 400);
  if (!ALLOWED_ACTIONS.has(action)) {
    return json({ error: `Unknown action "${action}"` }, 400);
  }

  // 3. Insert log entry
  const { data: log, error: insertError } = await serviceClient
    .from("activity_log")
    .insert({
      device_id:    deviceId,
      app_name:     appName,
      action,
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return json({ error: "Failed to insert activity log" }, 500);
  }

  return json({ log_id: log.id });
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
