-- ==============================================================================
-- Fix RLS Infinite Recursion between orders and customers
-- ==============================================================================

-- 1. Create SECURITY DEFINER function to get customer IDs for an auth user without triggering RLS loops
CREATE OR REPLACE FUNCTION public.get_customer_id_by_auth(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE auth_user_id = p_user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_id_by_auth(uuid) TO authenticated, anon;

-- 2. Drop and recreate policies on public.orders avoiding direct cross-table RLS recursion
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
CREATE POLICY "Customers can insert own orders" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    OR customer_id = public.get_customer_id_by_auth(auth.uid())
    OR (customer_id IS NULL AND auth.uid() IS NOT NULL)
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR customer_id = public.get_customer_id_by_auth(auth.uid())
  );

DROP POLICY IF EXISTS "Customers can cancel own orders" ON public.orders;
CREATE POLICY "Customers can cancel own orders" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    (
      customer_id = auth.uid()
      OR customer_id = public.get_customer_id_by_auth(auth.uid())
    )
    AND order_status IN ('new', 'placed', 'accepted', 'searching')
  )
  WITH CHECK (
    order_status = 'cancelled'
  );

-- 3. Update public.rides policies to use the same security definer function
DROP POLICY IF EXISTS "Customers can insert own rides" ON public.rides;
CREATE POLICY "Customers can insert own rides" ON public.rides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    OR customer_id = public.get_customer_id_by_auth(auth.uid())
    OR (customer_id IS NULL AND auth.uid() IS NOT NULL)
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can view own rides" ON public.rides;
CREATE POLICY "Customers can view own rides" ON public.rides
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR customer_id = public.get_customer_id_by_auth(auth.uid())
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can cancel own rides" ON public.rides;
CREATE POLICY "Customers can cancel own rides" ON public.rides
  FOR UPDATE
  TO authenticated
  USING (
    (
      customer_id = auth.uid()
      OR customer_id = public.get_customer_id_by_auth(auth.uid())
    )
    AND status IN ('searching', 'accepted')
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- 4. Clean up vendors policy on customers so it doesn't trigger recursion
DROP POLICY IF EXISTS "Vendors can view own customers" ON public.customers;
CREATE POLICY "Vendors can view own customers" ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_master_admin()
  );

-- 5. Add DELETE policy for customers to cancel/clean up own pending/searching orders & rides
DROP POLICY IF EXISTS "Customers can delete own cancelled orders" ON public.orders;
CREATE POLICY "Customers can delete own cancelled orders" ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    (customer_id = auth.uid() OR customer_id = public.get_customer_id_by_auth(auth.uid()))
    AND order_status IN ('cancelled', 'placed', 'new', 'searching')
  );

DROP POLICY IF EXISTS "Customers can delete own cancelled rides" ON public.rides;
CREATE POLICY "Customers can delete own cancelled rides" ON public.rides
  FOR DELETE
  TO authenticated
  USING (
    (customer_id = auth.uid() OR customer_id = public.get_customer_id_by_auth(auth.uid()))
    AND status IN ('cancelled', 'searching')
  );
