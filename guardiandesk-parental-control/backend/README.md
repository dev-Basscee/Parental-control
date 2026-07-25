# GuardianDesk — Backend Deployment Guide

## Directory layout

```
backend/
└── supabase/
    ├── migrations/
    │   ├── 001_initial_schema.sql      ← tables, enums, RLS, indexes, realtime
    │   └── 002_hash_token_helper.sql   ← bcrypt helper (called by pair-device)
    └── functions/
        ├── generate-pairing-code/index.js
        ├── pair-device/index.js
        ├── sync-apps/index.js
        ├── report-activity/index.js
        └── expire-timed-rules/index.js
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Supabase CLI](https://supabase.com/docs/guides/cli) | ≥ 1.170 |
| Node.js | ≥ 18 (only needed locally for `supabase` CLI) |
| A Supabase project | [app.supabase.com](https://app.supabase.com) |

---

## Step 1 — Link your project

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

`YOUR_PROJECT_REF` is the string in your Supabase dashboard URL:
`https://app.supabase.com/project/<YOUR_PROJECT_REF>`

---

## Step 2 — Run the SQL migrations

### Option A — Supabase CLI (recommended)

```bash
supabase db push
```

This applies every file in `migrations/` in lexicographic order.

### Option B — SQL Editor

1. Open **Supabase Dashboard → SQL Editor**.
2. Paste and run `001_initial_schema.sql` first.
3. Paste and run `002_hash_token_helper.sql` second.

---

## Step 3 — Deploy Edge Functions

Each Edge Function lives in its own subfolder under `functions/`. Deploy all at
once:

```bash
supabase functions deploy generate-pairing-code
supabase functions deploy pair-device
supabase functions deploy sync-apps
supabase functions deploy report-activity
supabase functions deploy expire-timed-rules
```

> **Note:** Supabase Edge Functions run on Deno. The `index.js` files use the
> standard Web Crypto API and `https://esm.sh` imports — no `npm install`
> needed.

---

## Step 4 — Set environment secrets

All functions read these from Deno.env. Set them once and they are injected at
deploy time:

```bash
supabase secrets set \
  SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co \
  SUPABASE_ANON_KEY=<your-anon-key> \
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Find the keys in **Dashboard → Settings → API**.

> ⚠️ **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend. It is
> only used inside Edge Functions running on Supabase's servers.

---

## Step 5 — Enable Realtime

The migration already runs:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.apps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rules;
```

Verify in **Dashboard → Database → Replication** that both tables appear under
`supabase_realtime`.

### Subscribing from the Windows agent (JS/Node snippet)

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The agent subscribes using the parent's access token so RLS
// only delivers rows for this device.
supabase.auth.setSession({ access_token: parentJwt, refresh_token: '' });

supabase
  .channel('agent-rules')
  .on(
    'postgres_changes',
    {
      event:  '*',
      schema: 'public',
      table:  'rules',
      filter: `apps.device_id=eq.${deviceId}`,  // filter on joined device
    },
    (payload) => {
      console.log('Rule changed:', payload);
      // enforce or lift the block immediately
    }
  )
  .subscribe();
```

> For deep-row filtering (rules → apps → device_id), you may need to subscribe
> to `apps` changes with `filter: 'device_id=eq.<id>'` and then separately
> fetch the updated rule. Supabase Realtime v2 supports direct column filters.

---

## Step 6 — Set up the expire-timed-rules cron

### Option A — Supabase `pg_cron` (recommended, no external service)

Run in the SQL Editor:

```sql
SELECT cron.schedule(
  'expire-timed-rules',          -- job name
  '* * * * *',                   -- every 1 minute
  $$
    SELECT net.http_post(
      url    := 'https://<YOUR_PROJECT_REF>.functions.supabase.co/expire-timed-rules',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type',  'application/json'
      ),
      body   := '{}'::jsonb
    );
  $$
);
```

Store the key as a DB setting (once, in the SQL Editor):

```sql
ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
```

### Option B — External cron (GitHub Actions, cron-job.org, etc.)

```bash
# run every minute
curl -X POST \
  https://<YOUR_PROJECT_REF>.functions.supabase.co/expire-timed-rules \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```

---

## Auth flow summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  Parent Dashboard (React)                                           │
│  → Supabase Auth (email/password) → gets JWT                       │
│  → calls generate-pairing-code with JWT in Authorization header    │
│  → receives { device_id, pairing_code, expires_at }                │
│  → shows 6-digit code to parent                                     │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ parent types code into agent
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Windows Agent (child's PC)                                         │
│  → calls pair-device with { pairing_code }                         │
│  → receives { device_id, device_token }  (one-time, stored locally)│
│  → every 60s: calls sync-apps with x-device-id + x-device-token   │
│  → on block event: calls report-activity with same headers         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## RLS quick-reference

| Table | Who can read | Who can write |
|-------|-------------|---------------|
| `devices` | Parent (own rows only, via `parent_id = auth.uid()`) | Parent |
| `apps` | Parent (device belongs to them) | Edge Functions (service_role) |
| `rules` | Parent (app → device belongs to them) | Parent |
| `activity_log` | Parent (device belongs to them) | Parent + Edge Functions |

The Windows agent **never** connects to Supabase directly. It only calls
Edge Functions, which run as `service_role` and validate the agent's token
before any DB write.

---

## Local development

```bash
# Start a local Supabase stack (Postgres + Auth + Edge runtime)
supabase start

# Serve functions locally with hot reload
supabase functions serve --env-file .env.local

# .env.local
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
```

Test the pairing flow end-to-end:

```bash
# 1. Generate a code (replace TOKEN with a valid parent JWT)
curl -X POST http://localhost:54321/functions/v1/generate-pairing-code \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Test PC"}'

# 2. Pair using the code returned above
curl -X POST http://localhost:54321/functions/v1/pair-device \
  -H "Content-Type: application/json" \
  -d '{"pairing_code": "123456"}'

# 3. Sync apps using device credentials
curl -X POST http://localhost:54321/functions/v1/sync-apps \
  -H "x-device-id: <device_id>" \
  -H "x-device-token: <device_token>" \
  -H "Content-Type: application/json" \
  -d '{"apps": [{"app_name": "Roblox.exe", "display_name": "Roblox"}]}'
```
