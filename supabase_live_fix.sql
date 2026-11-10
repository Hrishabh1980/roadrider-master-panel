-- ============================================================================
--  RoadRider — Safe Admin Bootstrap Script
--
--  BUG-002 FIX: The previous version of this file applied blanket
--  USING (true) WITH CHECK (true) policies to ALL tables, dropped ALL
--  check constraints, and removed NOT NULL constraints, granting
--  unauthenticated anonymous clients full read/write/delete access.
--
--  This replacement script applies SECURE, role-based RLS policies that
--  restrict access to authenticated admin users only.
--
--  Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 0: Ensure the is_master_admin() helper function exists
-- (Full definition is in migration 20261103_is_master_admin_function.sql)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN v_role = 'admin';
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_master_admin() FROM anon, public;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 1: ENABLE RLS ON ALL PUBLIC TABLES
-- (Safe – this just enables the RLS layer; policies below restrict access)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2: DROP THE OLD PERMISSIVE "Admin Full Access" POLICY
-- (Remove the USING (true) blanket policy from every table)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access" ON public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3: APPLY SECURE ADMIN-ONLY RLS POLICIES
-- Only authenticated users with role='admin' in public.profiles can access data.
-- Anonymous clients (anon key) are DENIED all access.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    BEGIN
      -- Read access: only admin role
      EXECUTE format(
        'CREATE POLICY "Admin Read Access" ON public.%I '
        'FOR SELECT TO authenticated '
        'USING (public.is_master_admin())',
        tbl
      );
      -- Write access: only admin role
      EXECUTE format(
        'CREATE POLICY "Admin Write Access" ON public.%I '
        'FOR ALL TO authenticated '
        'USING (public.is_master_admin()) '
        'WITH CHECK (public.is_master_admin())',
        tbl
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4: RESTORE ANY ACCIDENTALLY DROPPED CHECK CONSTRAINTS
-- Note: Specific constraints below; add more as needed per supabase_schema.sql
-- ────────────────────────────────────────────────────────────────────────────

-- customers table
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_status_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_status_check
  CHECK (status IN ('Active', 'Suspended', 'Inactive'));

-- orders table
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'assigned', 'in_transit', 'delivered', 'completed', 'cancelled'));

-- admin_users table
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('Active', 'Suspended', 'Inactive'));

-- pricing_rules table
ALTER TABLE public.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_status_check;
ALTER TABLE public.pricing_rules ADD CONSTRAINT pricing_rules_status_check
  CHECK (status IN ('Active', 'Inactive'));

-- surge_rules table
ALTER TABLE public.surge_rules DROP CONSTRAINT IF EXISTS surge_rules_status_check;
ALTER TABLE public.surge_rules ADD CONSTRAINT surge_rules_status_check
  CHECK (status IN ('Active', 'Inactive'));

-- promotions table
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_status_check;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_status_check
  CHECK (status IN ('Active', 'Expired', 'Scheduled'));

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 5: VERIFY SETUP
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('Admin Read Access', 'Admin Write Access')
ORDER BY tablename, policyname;
