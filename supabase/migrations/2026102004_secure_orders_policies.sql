-- Inspect and clean up any overly permissive or obsolete policies on public.orders and public.rides
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND (
        'anon' = ANY(roles) 
        OR 'public' = ANY(roles)
        OR policyname ILIKE '%anon%'
        OR policyname ILIKE '%public%'
        OR policyname ILIKE '%all%'
      )
  ) LOOP
    RAISE NOTICE 'Dropping public/anon policy on orders: %', r.policyname;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
  END LOOP;
END $$;

-- Verify RLS is enabled and forced
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Ensure ONLY authenticated customers can insert their own orders
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
CREATE POLICY "Customers can insert own orders" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      customer_id = auth.uid()
      OR customer_id = public.get_customer_id_by_auth(auth.uid())
      OR (customer_id IS NULL AND auth.uid() IS NOT NULL)
    )
    OR public.is_master_admin()
  );

-- Ensure ONLY the owner customer, assigned/eligible partner, or admin can select orders
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR customer_id = public.get_customer_id_by_auth(auth.uid())
  );

DROP POLICY IF EXISTS "Partners can view available and assigned orders" ON public.orders;
CREATE POLICY "Partners can view available and assigned orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    (
      partner_id IS NULL 
      AND order_status IN ('placed', 'new', 'searching')
      AND EXISTS (
        SELECT 1 FROM public.partners 
        WHERE user_id = auth.uid() 
          AND status = 'online' 
          AND is_active = true 
          AND kyc_status IN ('verified', 'approved')
      )
    )
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  );
