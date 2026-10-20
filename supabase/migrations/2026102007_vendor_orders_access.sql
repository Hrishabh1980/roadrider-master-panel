-- ==============================================================================
-- Migration: Vendor Orders Access, RLS Policies, and Realtime Integrity
-- ==============================================================================

-- 1. Ensure vendor_id column exists on public.orders and sync trigger is in place
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id);

CREATE OR REPLACE FUNCTION public.sync_order_vendor_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.store_id IS NOT NULL AND NEW.vendor_id IS NULL THEN
    SELECT vendor_id INTO NEW.vendor_id
    FROM public.stores
    WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_order_vendor_id ON public.orders;
CREATE TRIGGER trg_sync_order_vendor_id
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_vendor_id();

-- Backfill vendor_id for any existing store orders
UPDATE public.orders o
SET vendor_id = s.vendor_id
FROM public.stores s
WHERE o.store_id = s.id AND o.vendor_id IS NULL;

-- 2. Non-recursive security definer helper functions for vendor ownership
CREATE OR REPLACE FUNCTION public.is_vendor_store_owner(p_store_id uuid)
RETURNS boolean AS $$
BEGIN
  IF p_store_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 
    FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = p_store_id 
      AND v.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_vendor_owner(p_vendor_id uuid)
RETURNS boolean AS $$
BEGIN
  IF p_vendor_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 
    FROM public.vendors v
    WHERE v.id = p_vendor_id 
      AND v.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_vendor_store_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_vendor_owner(uuid) TO authenticated, anon;

-- 3. Orders RLS Policies for Vendors
-- Ensure RLS is enabled and forced
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

-- Vendors can view own store orders
DROP POLICY IF EXISTS "Vendors can view own store orders" ON public.orders;
CREATE POLICY "Vendors can view own store orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_vendor_store_owner(store_id)
    OR (vendor_id IS NOT NULL AND public.is_vendor_owner(vendor_id))
    OR public.is_master_admin()
  );

-- Vendors can update own store orders (accept, mark ready, reject, handover)
DROP POLICY IF EXISTS "Vendors can update own store orders" ON public.orders;
CREATE POLICY "Vendors can update own store orders" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.is_vendor_store_owner(store_id)
    OR (vendor_id IS NOT NULL AND public.is_vendor_owner(vendor_id))
    OR public.is_master_admin()
  )
  WITH CHECK (
    public.is_vendor_store_owner(store_id)
    OR (vendor_id IS NOT NULL AND public.is_vendor_owner(vendor_id))
    OR public.is_master_admin()
  );

-- 4. Order Items RLS Policies for Customers, Vendors, Partners, Admins
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;

-- SELECT policy on order_items
DROP POLICY IF EXISTS "Users can view relevant order items" ON public.order_items;
CREATE POLICY "Users can view relevant order items" ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.customer_id = auth.uid()
          OR o.customer_id = public.get_customer_id_by_auth(auth.uid())
          OR public.is_vendor_store_owner(o.store_id)
          OR (o.vendor_id IS NOT NULL AND public.is_vendor_owner(o.vendor_id))
          OR o.partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
          OR public.is_master_admin()
        )
    )
  );

-- INSERT policy on order_items (customers placing orders or master admins)
DROP POLICY IF EXISTS "Customers can insert order items" ON public.order_items;
CREATE POLICY "Customers can insert order items" ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.customer_id = auth.uid()
          OR o.customer_id = public.get_customer_id_by_auth(auth.uid())
          OR (o.customer_id IS NULL AND auth.uid() IS NOT NULL)
          OR public.is_master_admin()
        )
    )
  );

-- 5. Realtime Publication & Replica Identity
ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
