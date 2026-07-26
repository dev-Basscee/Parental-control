-- =============================================================================
-- GuardianDesk – Migration 002: hash_device_token helper
--
-- pair-device calls this RPC to bcrypt-hash the raw token inside Postgres
-- so the plaintext never leaves the database tier.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hash_device_token(raw_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- gen_salt('bf', 10) produces a bcrypt salt with cost=10
  RETURN crypt(raw_token, gen_salt('bf', 10));
END; 
$$;

-- Restrict execution to service_role only — never callable from a browser JWT
REVOKE EXECUTE ON FUNCTION public.hash_device_token(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hash_device_token(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hash_device_token(TEXT) FROM authenticated;
