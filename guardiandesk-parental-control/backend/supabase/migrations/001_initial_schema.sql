-- =============================================================================
-- GuardianDesk – Initial Schema Migration
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()


-- ---------------------------------------------------------------------------
-- 1. Custom ENUM types
-- ---------------------------------------------------------------------------
CREATE TYPE device_status  AS ENUM ('pending', 'connected', 'offline');
CREATE TYPE app_status     AS ENUM ('allowed', 'blocked', 'scheduled');
CREATE TYPE rule_type_enum AS ENUM ('forever', 'timed', 'scheduled');


-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- 2a. devices
CREATE TABLE public.devices (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name    TEXT          NOT NULL,
  pairing_code   TEXT          UNIQUE,
  pairing_expires_at TIMESTAMPTZ,
  device_token_hash  TEXT,          -- bcrypt hash of the long-lived agent token
  status         device_status NOT NULL DEFAULT 'pending',
  last_seen_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2b. apps
CREATE TABLE public.apps (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      UUID          NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  app_name       TEXT          NOT NULL,   -- e.g. "Roblox.exe"
  display_name   TEXT          NOT NULL,   -- e.g. "Roblox"
  status         app_status    NOT NULL DEFAULT 'allowed',
  last_updated   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, app_name)             -- one row per exe per device
);

-- 2c. rules
CREATE TABLE public.rules (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           UUID           NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  rule_type        rule_type_enum NOT NULL,
  duration_minutes INT,            -- for 'timed'
  schedule_days    TEXT[],         -- for 'scheduled', e.g. ARRAY['Mon','Wed']
  schedule_start   TIME,           -- for 'scheduled'
  schedule_end     TIME,           -- for 'scheduled'
  expires_at       TIMESTAMPTZ,    -- computed for 'timed'
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 2d. activity_log
CREATE TABLE public.activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID        NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  app_name     TEXT        NOT NULL,
  action       TEXT        NOT NULL,   -- 'blocked' | 'unblocked' | 'device_connected' …
  triggered_by TEXT        NOT NULL DEFAULT 'system',  -- 'parent' | 'system'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_devices_parent_id      ON public.devices(parent_id);
CREATE INDEX idx_devices_pairing_code   ON public.devices(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX idx_apps_device_id         ON public.apps(device_id);
CREATE INDEX idx_rules_app_id           ON public.rules(app_id);
CREATE INDEX idx_rules_expires_at       ON public.rules(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_activity_log_device_id ON public.activity_log(device_id);
CREATE INDEX idx_activity_log_created   ON public.activity_log(created_at DESC);


-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.devices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;


-- ── devices ─────────────────────────────────────────────────────────────────
-- Parents can only see and modify their own devices.
CREATE POLICY "parent_select_devices" ON public.devices
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "parent_insert_devices" ON public.devices
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "parent_update_devices" ON public.devices
  FOR UPDATE USING (parent_id = auth.uid());

CREATE POLICY "parent_delete_devices" ON public.devices
  FOR DELETE USING (parent_id = auth.uid());

-- Edge functions run as service_role and bypass RLS by default.
-- The Windows agent never touches Supabase directly — it only calls Edge Functions.


-- ── apps ────────────────────────────────────────────────────────────────────
-- A parent can access apps whose device belongs to them.
CREATE POLICY "parent_select_apps" ON public.apps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = apps.device_id AND d.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_insert_apps" ON public.apps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = apps.device_id AND d.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_update_apps" ON public.apps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = apps.device_id AND d.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_delete_apps" ON public.apps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = apps.device_id AND d.parent_id = auth.uid()
    )
  );


-- ── rules ────────────────────────────────────────────────────────────────────
-- A parent can access rules whose app → device belongs to them.
CREATE POLICY "parent_select_rules" ON public.rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.apps a
      JOIN  public.devices d ON d.id = a.device_id
      WHERE a.id = rules.app_id AND d.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_insert_rules" ON public.rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.apps a
      JOIN  public.devices d ON d.id = a.device_id
      WHERE a.id = rules.app_id AND d.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_update_rules" ON public.rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.apps a
      JOIN  public.devices d ON d.id = a.device_id
      WHERE a.id = rules.app_id AND d.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_delete_rules" ON public.rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.apps a
      JOIN  public.devices d ON d.id = a.device_id
      WHERE a.id = rules.app_id AND d.parent_id = auth.uid()
    )
  );


-- ── activity_log ─────────────────────────────────────────────────────────────
CREATE POLICY "parent_select_logs" ON public.activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = activity_log.device_id AND d.parent_id = auth.uid()
    )
  );

-- Parents can insert logs from the dashboard (e.g. manual block).
CREATE POLICY "parent_insert_logs" ON public.activity_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = activity_log.device_id AND d.parent_id = auth.uid()
    )
  );

-- Logs are immutable; no UPDATE/DELETE policies for parents.


-- ---------------------------------------------------------------------------
-- 5. Supabase Realtime – publication
-- ---------------------------------------------------------------------------
-- Add apps and rules to the supabase_realtime publication so connected agents
-- can subscribe and receive row-level change events.
--
-- The publication already exists in Supabase-managed projects.
-- Run each ALTER separately if needed.
ALTER PUBLICATION supabase_realtime ADD TABLE public.apps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rules;


-- ---------------------------------------------------------------------------
-- 6. Helper function: validate_device_token(device_id, raw_token)
--    Used by Edge Functions to authenticate the Windows agent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_device_token(
  p_device_id UUID,
  p_raw_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as superuser so it can read device_token_hash
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- Reject obviously invalid inputs before touching the DB
  IF p_raw_token IS NULL OR length(p_raw_token) < 32 THEN
    RETURN FALSE;
  END IF;

  SELECT device_token_hash INTO v_hash
  FROM public.devices
  WHERE id = p_device_id AND status = 'connected';

  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- crypt() re-hashes p_raw_token with the stored salt and compares
  RETURN (crypt(p_raw_token, v_hash) = v_hash);
END;
$$;

-- Restrict direct execution to service_role only.
-- Edge Functions use service_role; anon/authenticated users cannot call this.
REVOKE EXECUTE ON FUNCTION public.validate_device_token(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_device_token(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_device_token(UUID, TEXT) FROM authenticated;
