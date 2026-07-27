/**
 * Edge Function: generate-pairing-code
 *
 * Called by the parent dashboard to create a new device entry with a
 * 6-digit pairing code that expires in 15 minutes.
 *
 * Method : POST
 * Auth   : Authorization: Bearer <supabase_user_jwt>
 * Body   : { device_name: string }
 *
 * Response 200: { device_id, pairing_code, expires_at }
 * Response 4xx: { error: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Authenticate the parent via their JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Parse and validate body
  let body: { device_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const deviceName = (body.device_name ?? "").trim();
  if (!deviceName) {
    return json({ error: "device_name is required" }, 400);
  }

  // 3. Generate a 6-digit code and 15-minute expiry
  const pairingCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt   = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // 4. Insert using service-role client so RLS is bypassed for the insert
  //    (The parent_id is explicitly set to the verified user.id — still secure.)
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error: insertError } = await serviceClient
    .from("devices")
    .insert({
      parent_id:          user.id,
      device_name:        deviceName,
      pairing_code:       pairingCode,
      pairing_expires_at: expiresAt,
      status:             "pending",
    })
    .select("id, pairing_code, pairing_expires_at")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return json({ error: "Failed to create device" }, 500);
  }

  return json({
    device_id:    data.id,
    pairing_code: data.pairing_code,
    expires_at:   data.pairing_expires_at,
  });
});
