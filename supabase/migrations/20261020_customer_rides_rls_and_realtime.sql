-- ==============================================================================
-- RoadRider Migration: Customer App RLS, Realtime & Vendor Listings Fix
-- ==============================================================================

-- 1. STORES & VENDORS VISIBILITY
-- Allow authenticated and anonymous users to view approved vendors
DROP POLICY IF EXISTS "Public can view approved vendors" ON public.vendors;
CREATE POLICY "Public can view approved vendors" ON public.vendors
  FOR SELECT
  TO authenticated, anon
  USING (
    onboarding_status IN ('approved', 'live')
  );

-- Ensure active online store vendors are approved
UPDATE public.vendors
SET onboarding_status = 'approved'
WHERE id IN (
  SELECT vendor_id FROM public.stores 
  WHERE is_active = true AND status = 'ONLINE'
)
AND onboarding_status NOT IN ('approved', 'live', 'suspended', 'rejected');

-- 2. CUSTOMERS TABLE RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
CREATE POLICY "Customers can view own profile" ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
CREATE POLICY "Customers can insert own profile" ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid() 
    OR auth_user_id IS NULL
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

-- 3. ORDERS TABLE SCHEMA RELAXATIONS FOR RIDES & COURIER
ALTER TABLE public.orders ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN commission_amount DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN gst_on_commission DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN net_vendor_payout DROP NOT NULL;

-- 4. ORDERS TABLE RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customer can INSERT only orders for themselves (Customer Isolation)
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
CREATE POLICY "Customers can insert own orders" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR customer_id = auth.uid()
    OR (customer_id IS NULL AND auth.uid() IS NOT NULL)
    OR public.is_master_admin()
  );

-- Customer can SELECT only their own orders (Customer Isolation)
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR customer_id = auth.uid()
  );

-- Customer can cancel their own order before it is in progress
DROP POLICY IF EXISTS "Customers can cancel own orders" ON public.orders;
CREATE POLICY "Customers can cancel own orders" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    (
      customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
      OR customer_id = auth.uid()
    )
    AND order_status IN ('new', 'placed', 'accepted', 'searching')
  )
  WITH CHECK (
    order_status = 'cancelled'
  );

-- Partners can SELECT available orders (unassigned) and assigned orders
DROP POLICY IF EXISTS "Partners can view available and assigned orders" ON public.orders;
CREATE POLICY "Partners can view available and assigned orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    (partner_id IS NULL AND order_status IN ('placed', 'new', 'accepted', 'ready', 'searching'))
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  );

-- Partners can claim an unassigned order or update an assigned order
DROP POLICY IF EXISTS "Partners can claim and update assigned orders" ON public.orders;
CREATE POLICY "Partners can claim and update assigned orders" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    (
      partner_id IS NULL 
      AND order_status IN ('placed', 'new', 'accepted', 'ready', 'searching')
      AND EXISTS (
        SELECT 1 FROM public.partners 
        WHERE user_id = auth.uid() AND status = 'online' AND is_active = true AND kyc_status IN ('verified', 'approved')
      )
    )
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  )
  WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  );

-- 5. ORDER ITEMS RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;
CREATE POLICY "Customers can insert own order items" ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders
      WHERE customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
         OR customer_id = auth.uid()
    )
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers and partners can view order items" ON public.order_items;
CREATE POLICY "Customers and partners can view order items" ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
         OR customer_id = auth.uid()
         OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
         OR (partner_id IS NULL AND order_status IN ('placed', 'new', 'accepted', 'ready', 'searching'))
         OR public.is_master_admin()
    )
  );

-- 6. RIDES TABLE RLS
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can insert own rides" ON public.rides;
CREATE POLICY "Customers can insert own rides" ON public.rides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR customer_id = auth.uid()
    OR (customer_id IS NULL AND auth.uid() IS NOT NULL)
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can view own rides" ON public.rides;
CREATE POLICY "Customers can view own rides" ON public.rides
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR customer_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Customers can cancel own rides" ON public.rides;
CREATE POLICY "Customers can cancel own rides" ON public.rides
  FOR UPDATE
  TO authenticated
  USING (
    (
      customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
      OR customer_id = auth.uid()
    )
    AND status IN ('searching', 'accepted')
  )
  WITH CHECK (
    status = 'cancelled'
  );

DROP POLICY IF EXISTS "Partners can view available and assigned rides" ON public.rides;
CREATE POLICY "Partners can view available and assigned rides" ON public.rides
  FOR SELECT
  TO authenticated
  USING (
    (partner_id IS NULL AND status = 'searching')
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Partners can claim and update assigned rides" ON public.rides;
CREATE POLICY "Partners can claim and update assigned rides" ON public.rides
  FOR UPDATE
  TO authenticated
  USING (
    (
      partner_id IS NULL 
      AND status = 'searching' 
      AND EXISTS (
        SELECT 1 FROM public.partners 
        WHERE user_id = auth.uid() AND status = 'online' AND is_active = true AND kyc_status IN ('verified', 'approved')
      )
    )
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  )
  WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_master_admin()
  );

-- 7. REPLICA IDENTITY & REALTIME PUBLICATION
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
  END IF;
END $$;

-- 8. UPDATE protect_order_financials TRIGGER TO SUPPORT RIDES & DELIVERY LIFECYCLE
CREATE OR REPLACE FUNCTION public.protect_order_financials()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    -- Block modifications to financial, identity, and system fields
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.packaging_fee IS DISTINCT FROM OLD.packaging_fee
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
       OR NEW.gst_on_commission IS DISTINCT FROM OLD.gst_on_commission
       OR NEW.net_vendor_payout IS DISTINCT FROM OLD.net_vendor_payout
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
       OR NEW.store_id IS DISTINCT FROM OLD.store_id
       OR NEW.order_number IS DISTINCT FROM OLD.order_number
       OR NEW.placed_at IS DISTINCT FROM OLD.placed_at
    THEN
      RAISE EXCEPTION 'Unauthorized: Financial, calculation, identity, and payment fields cannot be modified.';
    END IF;

    -- Enforce legitimate state transitions across delivery and ride lifecycle
    IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
      IF OLD.order_status IN ('new', 'placed', 'searching') AND NEW.order_status NOT IN ('accepted', 'preparing', 'rejected', 'cancelled', 'arrived') THEN
        RAISE EXCEPTION 'Invalid transition: New orders can only transition to accepted, preparing, or rejected.';
      ELSIF OLD.order_status = 'accepted' AND NEW.order_status NOT IN ('preparing', 'arrived', 'in_transit', 'on_the_way', 'picked_up', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: Accepted orders can only transition to preparing, arrived, in_transit, or cancelled.';
      ELSIF OLD.order_status = 'arrived' AND NEW.order_status NOT IN ('in_transit', 'on_the_way', 'picked_up', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: Arrived orders can only transition to in_transit or cancelled.';
      ELSIF OLD.order_status = 'preparing' AND NEW.order_status NOT IN ('ready', 'handed_over', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: Preparing orders can only transition to ready or cancelled.';
      ELSIF OLD.order_status = 'ready' AND NEW.order_status NOT IN ('handed_over', 'picked_up', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: Ready orders can only transition to handed_over, picked_up, or completed.';
      ELSIF OLD.order_status = 'handed_over' AND NEW.order_status NOT IN ('in_transit', 'picked_up', 'delivered', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: Handed over orders can only transition to in_transit, picked_up, or delivered.';
      ELSIF OLD.order_status IN ('in_transit', 'picked_up', 'on_the_way') AND NEW.order_status NOT IN ('delivered', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition: In-transit orders can only transition to delivered or completed.';
      ELSIF OLD.order_status IN ('completed', 'cancelled', 'rejected', 'delivered') THEN
        RAISE EXCEPTION 'Invalid transition: Terminal order states cannot be altered.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
