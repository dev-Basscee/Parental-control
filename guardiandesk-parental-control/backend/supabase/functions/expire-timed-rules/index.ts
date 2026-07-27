/**
 * Edge Function: expire-timed-rules  (Cron job — runs every 1 minute)
 *
 * Finds all 'timed' rules whose expires_at has passed, deletes them,
 * sets the related app.status back to 'allowed', and inserts an
 * activity_log entry per expiry so the parent dashboard shows it.
 *
 * Deploy this as an HTTP-triggered function and configure the cron to call it
 * with:
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Only accept requests carrying the service-role key as a bearer token
  const authHeader = req.headers.get("Authorization") ?? "";
  const token      = authHeader.replace("Bearer ", "").trim();

  if (token !== SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now           = new Date().toISOString();

  // 1. Fetch all expired timed rules with their app info
  const { data: expiredRules, error: fetchError } = await serviceClient
    .from("rules")
    .select(`
      id,
      app_id,
      apps (
        id,
        app_name,
        device_id
      )
    `)
    .eq("rule_type", "timed")
    .lt("expires_at", now);

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return jsonResponse({ error: "Failed to fetch expired rules" }, 500);
  }

  if (!expiredRules || expiredRules.length === 0) {
    return jsonResponse({ expired_count: 0 });
  }

  const results = await Promise.allSettled(
    expiredRules.map(async (rule: {
      id: string;
      app_id: string;
      apps: { id: string; app_name: string; device_id: string } | null;
    }) => {
      const app = rule.apps;
      if (!app) return;

      // 2a. Set app status back to 'allowed'
      const { error: appUpdateError } = await serviceClient
        .from("apps")
        .update({ status: "allowed", last_updated: now })
        .eq("id", app.id);

      if (appUpdateError) {
        console.error(`Failed to reset app ${app.id}:`, appUpdateError);
        throw appUpdateError;
      }

      // 2b. Delete the expired rule
      const { error: deleteError } = await serviceClient
        .from("rules")
        .delete()
        .eq("id", rule.id);

      if (deleteError) {
        console.error(`Failed to delete rule ${rule.id}:`, deleteError);
        throw deleteError;
      }

      // 2c. Insert activity log entry so the parent dashboard shows the expiry
      const { error: logError } = await serviceClient
        .from("activity_log")
        .insert({
          device_id:    app.device_id,
          app_name:     app.app_name,
          action:       "unblocked",
          triggered_by: "system",
        });

      if (logError) {
        console.warn(`Failed to write log for rule ${rule.id}:`, logError);
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(`expire-timed-rules: processed ${expiredRules.length}, ok=${succeeded}, failed=${failed}`);

  return jsonResponse({ expired_count: succeeded, failed_count: failed });
});
