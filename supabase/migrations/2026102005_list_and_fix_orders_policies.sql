-- Drop any policy on public.orders that permits SELECT to anon
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname, roles, cmd, qual
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders'
  ) LOOP
    RAISE NOTICE 'Found policy on orders: % | cmd: % | roles: %', p.policyname, p.cmd, p.roles;
    IF p.cmd = 'SELECT' AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles)) THEN
      RAISE NOTICE 'Dropping public/anon SELECT policy on orders: %', p.policyname;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', p.policyname);
    END IF;
  END LOOP;
END $$;

-- Verify RLS is enabled and forced on orders and order_items
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides FORCE ROW LEVEL SECURITY;

-- Recreate strict SELECT policies for orders:
-- ONLY the customer who owns the order, OR verified approved online partners, OR master admin
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR customer_id = public.get_customer_id_by_auth(auth.uid())
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Partners can view available and assigned orders" ON public.orders;
CREATE POLICY "Partners can view available and assigned orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR (
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
    OR public.is_master_admin()
  );
