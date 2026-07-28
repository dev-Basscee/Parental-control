-- Migration 005: add is_locked column to devices
-- The agent subscribes to UPDATE events on this row via Realtime.
-- When is_locked becomes true the agent kills all user processes on the child PC.
-- Already in supabase_realtime publication via migration 003.

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
