/**
 * lib/supabase.ts
 *
 * Single shared Supabase client instance for the entire GuardianDesk
 * parent dashboard frontend.
 *
 * Used for:
 *   - Auth (email/password sign-in via Supabase Auth)
 *   - Realtime subscriptions (activity_log live feed in LogsView)
 *   - Direct table queries from the parent's browser (all behind RLS)
 *
 * The VITE_ prefix makes these variables available in the browser bundle
 * via import.meta.env — Vite strips any env var that is NOT prefixed.
 *
 * Set these in a .env.local file (never commit it):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-key>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'See .env.example for the required format.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Calls the generate-pairing-code Edge Function with the parent's session JWT.
 * Returns { device_id, pairing_code, expires_at } on success.
 * Throws on network or auth failure.
 */
export async function generatePairingCode(deviceName: string): Promise<{
  device_id: string;
  pairing_code: string;
  expires_at: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated — please sign in first.');

  const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1';

  const res = await fetch(`${FUNCTIONS_URL}/generate-pairing-code`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ device_name: deviceName }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

  return json as { device_id: string; pairing_code: string; expires_at: string };
}
