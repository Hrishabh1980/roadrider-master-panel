-- ==============================================================================
-- Schema Alignment: Support Tickets, Vendor Relationships & Admin Responses
-- ==============================================================================
-- As confirmed by database schema audit:
-- 1. public.support_tickets already contains:
--    - id (uuid, primary key)
--    - ticket_number (text)
--    - vendor_id (uuid, foreign key -> public.vendors.id)
--    - store_id (uuid, foreign key -> public.stores.id)
--    - customer_id (uuid, foreign key -> public.customers.id)
--    - partner_id (uuid, foreign key -> public.partners.id)
--    - order_id (uuid, foreign key -> public.orders.id)
--    - requester_type (text)
--    - admin_message (text)
--    - created_at (timestamptz)
--    - updated_at (timestamptz)
--
-- 2. No redundant columns (e.g. vendor_name, customer_name) are needed on
--    support_tickets. When a vendor raises a ticket, the ticket is linked via
--    vendor_id (Vendor UID). The application uses this UID to fetch all of the
--    vendor's data (business name, owner name, phone, email, stores, KYC status)
--    directly from public.vendors.
-- ==============================================================================

-- Optional: Ensure trigger automatically updates updated_at timestamp when admin responds
CREATE OR REPLACE FUNCTION public.handle_support_ticket_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_ticket_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_support_ticket_updated_at();

-- Optional: Fast lookup index on vendor_id
CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor_id ON public.support_tickets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_updated_at ON public.support_tickets(updated_at DESC);
