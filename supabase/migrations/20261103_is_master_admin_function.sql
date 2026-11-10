-- ============================================================
-- BUG-008 FIX: Define the missing public.is_master_admin() function
-- Referenced by RLS policies in:
--   20261019_rider_approval_and_enforcement.sql
--   20261020_customer_rides_rls_and_realtime.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check if the calling user has admin role in public.profiles
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN v_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant execute to authenticated users (function is SECURITY DEFINER so it
-- runs with definer privileges, but callers must be authenticated)
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

-- Revoke from anonymous / public – no unauthenticated access
REVOKE EXECUTE ON FUNCTION public.is_master_admin() FROM anon, public;

COMMENT ON FUNCTION public.is_master_admin() IS
  'Returns TRUE if the currently authenticated user has role=''admin'' in public.profiles. '
  'Used as a SECURITY DEFINER guard in RLS policies and trigger functions.';
