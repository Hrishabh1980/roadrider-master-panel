-- Fix self-referencing recursion on public.customers
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile" ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
CREATE POLICY "Customers can insert own profile" ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
CREATE POLICY "Customers can update own profile" ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_master_admin()
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Vendors can view own customers" ON public.customers;
