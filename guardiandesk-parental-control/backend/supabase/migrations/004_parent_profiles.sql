-- =============================================================================
-- GuardianDesk – Migration 004: parent profiles
--
-- Supabase's built-in auth.users table stores only email + provider metadata.
-- This migration adds a public.parents table that holds display-facing profile
-- data (full name, avatar URL), and a trigger that creates a parents row
-- automatically whenever a new user signs up.
--
-- Why a trigger instead of doing it in the frontend?
--   • The frontend may be running with email confirmation enabled, so the user
--     has no session at sign-up time and cannot INSERT into parents via RLS.
--   • A SECURITY DEFINER trigger runs as the postgres superuser and fires
--     unconditionally on auth.users INSERT — it can never be skipped by a
--     client bug or a race condition.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table: public.parents
-- ---------------------------------------------------------------------------
CREATE TABLE public.parents (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index used by the dashboard's profile lookup (SELECT WHERE id = auth.uid()).
CREATE INDEX idx_parents_id ON public.parents(id);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Parents can only read/write their own profile row.
CREATE POLICY "parent_select_own_profile" ON public.parents
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "parent_update_own_profile" ON public.parents
  FOR UPDATE USING (id = auth.uid());

-- No INSERT policy — the trigger is the only writer for new rows.
-- No DELETE policy — profiles are retained when a user deletes their devices.


-- ---------------------------------------------------------------------------
-- 3. Trigger: auto-provision a parents row on every new auth.users INSERT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path must be explicit when using SECURITY DEFINER to prevent
-- a privilege-escalation attack via a rogue schema.
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.parents (id, full_name)
  VALUES (
    NEW.id,
    -- raw_user_meta_data is the jsonb blob from supabase.auth.signUp options.data
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: re-fires on email confirmation
  RETURN NEW;
END;
$$;

-- Fire after every new row in auth.users (covers both email/password and
-- OAuth providers — whichever path created the auth.users row).
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
