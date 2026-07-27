/**
 * Edge Function: pair-device
 *
 * Called by the Windows agent (NOT the dashboard) after the user enters the
 * pairing code on the child's machine.
 *
 * Method : POST
 * Auth   : None (public — rate-limit enforced by Supabase Edge)
 * Body   : { pairing_code: string }
 *
 * On success (200):
 *   { device_id, device_token }
 *   → device_token is a 64-char random hex string, returned ONCE and never again.
 *     The agent must persist it securely. GuardianDesk stores only its bcrypt hash.
 *
 * On failure (400/404/410): { error: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
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

  let body: { pairing_code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const pairingCode = (body.pairing_code ?? "").trim();
  if (!pairingCode || !/^\d{6}$/.test(pairingCode)) {
    return json({ error: "pairing_code must be a 6-digit number" }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Look up the device by pairing code
  const { data: device, error: lookupError } = await serviceClient
    .from("devices")
    .select("id, status, pairing_expires_at")
    .eq("pairing_code", pairingCode)
    .single();

  if (lookupError || !device) {
    return json({ error: "Invalid pairing code" }, 404);
  }

  if (device.status !== "pending") {
    return json({ error: "Pairing code already used" }, 409);
  }

  if (new Date(device.pairing_expires_at) < new Date()) {
    return json({ error: "Pairing code has expired" }, 410);
  }

  // 2. Generate a cryptographically secure 64-char hex device token
  const rawTokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawToken      = Array.from(rawTokenBytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");

  // 3. Hash the token using pgcrypto's crypt() via an RPC call (bcrypt, cost=10)
  const { data: hashResult, error: hashError } = await serviceClient
    .rpc("hash_device_token", { raw_token: rawToken });

  if (hashError) {
    console.error("Hash error:", hashError);
    return json({ error: "Internal error during token hashing" }, 500);
  }

  // 4. Update the device: mark connected, store hash, clear pairing code
  const { error: updateError } = await serviceClient
    .from("devices")
    .update({
      status:             "connected",
      device_token_hash:  hashResult,
      pairing_code:       null,
      pairing_expires_at: null,
      last_seen_at:       new Date().toISOString(),
    })
    .eq("id", device.id);

  if (updateError) {
    console.error("Update error:", updateError);
    return json({ error: "Failed to complete pairing" }, 500);
  }

  // 5. Log the connection event
  await serviceClient.from("activity_log").insert({
    device_id:    device.id,
    app_name:     "system",
    action:       "device_connected",
    triggered_by: "system",
  });

  return json({ device_id: device.id, device_token: rawToken });
});
