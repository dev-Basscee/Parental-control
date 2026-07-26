-- =============================================================================
-- GuardianDesk – Migration 003: Realtime + RLS fixes
--
-- Run this in the Supabase SQL Editor after 001 and 002.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add activity_log and devices to the Realtime publication
--    Migration 001 only added apps and rules.
--    The frontend LogsView subscribes to activity_log INSERT events.
--    The frontend App.tsx subscribes to devices UPDATE events.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;

-- ---------------------------------------------------------------------------
-- 2. Add device_name to the apps table
--    Makes it possible to show "which device" each app belongs to in the
--    parent dashboard without a second join query.
--    NULL for existing rows — the agent will populate it on next sync.
-- ---------------------------------------------------------------------------
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS device_name TEXT;
