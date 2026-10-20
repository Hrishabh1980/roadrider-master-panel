-- ============================================================================
--  RoadRider Master Admin Panel — Supabase PostgreSQL Schema & Seed Script
--  Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. CUSTOMERS TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    city TEXT DEFAULT 'Lucknow',
    orders INTEGER DEFAULT 0,
    trips INTEGER DEFAULT 0,
    ltv NUMERIC(12,2) DEFAULT 0,
    wallet NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Inactive')),
    risk TEXT DEFAULT 'Low' CHECK (risk IN ('Low', 'Medium', 'High')),
    service TEXT DEFAULT 'Food',
    joined TEXT DEFAULT 'Today',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. VENDORS (Restaurants & Grocery Stores)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Restaurant', 'Grocery')),
    city TEXT DEFAULT 'Lucknow',
    zone TEXT DEFAULT 'Zone A',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Suspended')),
    orders INTEGER DEFAULT 0,
    revenue NUMERIC(14,2) DEFAULT 0,
    rating NUMERIC(3,1) DEFAULT 5.0,
    kyc TEXT DEFAULT 'Verified' CHECK (kyc IN ('Verified', 'Pending', 'Rejected')),
    payout TEXT DEFAULT 'Weekly',
    owner TEXT,
    phone TEXT,
    gst TEXT,
    pan TEXT,
    commission NUMERIC(5,2) DEFAULT 15.00,
    plan TEXT DEFAULT 'Standard',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. PARTNERS (Drivers & Delivery Fleet)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partners (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle TEXT NOT NULL CHECK (vehicle IN ('Motorcycle', 'Bicycle', 'Auto', 'Car')),
    services TEXT[] DEFAULT ARRAY['Food', 'Grocery', 'Courier']::TEXT[],
    city TEXT DEFAULT 'Lucknow',
    zone TEXT DEFAULT 'Zone A',
    status TEXT DEFAULT 'Online' CHECK (status IN ('Online', 'Busy', 'Offline', 'Suspended')),
    earnings NUMERIC(10,2) DEFAULT 0,
    rating NUMERIC(3,1) DEFAULT 5.0,
    acceptance TEXT DEFAULT '95%',
    completion TEXT DEFAULT '98%',
    cancellation TEXT DEFAULT '2%',
    kyc TEXT DEFAULT 'Verified' CHECK (kyc IN ('Verified', 'Pending', 'Rejected')),
    vehicle_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ORDERS (Food & Grocery Deliveries)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(50) PRIMARY KEY,
    customer TEXT NOT NULL,
    vendor TEXT NOT NULL,
    partner TEXT DEFAULT '—',
    service TEXT NOT NULL CHECK (service IN ('Food', 'Grocery')),
    amount NUMERIC(10,2) NOT NULL,
    payment TEXT DEFAULT 'UPI' CHECK (payment IN ('UPI', 'Card', 'Wallet', 'COD')),
    status TEXT DEFAULT 'Preparing' CHECK (status IN ('Delivered', 'In Transit', 'Preparing', 'Searching', 'Cancelled', 'Delayed', 'Disputed')),
    created TEXT DEFAULT 'Just now',
    eta TEXT DEFAULT '30 min',
    zone TEXT DEFAULT 'Zone A',
    city TEXT DEFAULT 'Lucknow',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. RIDES (Cabs & Auto Rickshaws)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rides (
    id VARCHAR(50) PRIMARY KEY,
    customer TEXT NOT NULL,
    partner TEXT DEFAULT '—',
    vehicle TEXT NOT NULL CHECK (vehicle IN ('Auto', 'Car', 'Motorcycle')),
    pickup TEXT NOT NULL,
    drop_loc TEXT NOT NULL,
    fare NUMERIC(10,2) NOT NULL,
    eta TEXT DEFAULT '10 min',
    status TEXT DEFAULT 'Searching' CHECK (status IN ('In Progress', 'Completed', 'Searching', 'Cancelled')),
    payment TEXT DEFAULT 'UPI',
    city TEXT DEFAULT 'Lucknow',
    zone TEXT DEFAULT 'Zone A',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. COURIER JOBS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_jobs (
    id VARCHAR(50) PRIMARY KEY,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    partner TEXT DEFAULT '—',
    type TEXT DEFAULT 'Parcel',
    weight TEXT DEFAULT '1.0 kg',
    vehicle TEXT DEFAULT 'Motorcycle',
    pickup TEXT NOT NULL,
    drop_loc TEXT NOT NULL,
    quote NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'Searching' CHECK (status IN ('Picked Up', 'Delivered', 'Searching', 'In Transit')),
    eta TEXT DEFAULT '30 min',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. TRANSACTIONS & FINANCIAL LEDGER
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
    id VARCHAR(50) PRIMARY KEY,
    entity TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Order Payment', 'Vendor Payout', 'Partner Payout', 'Wallet Topup', 'Refund')),
    service TEXT DEFAULT 'Food',
    amount NUMERIC(12,2) NOT NULL,
    fee NUMERIC(10,2) DEFAULT 0,
    tax NUMERIC(10,2) DEFAULT 0,
    method TEXT DEFAULT 'UPI' CHECK (method IN ('UPI', 'NEFT', 'IMPS', 'Card', 'Wallet', 'Cash')),
    status TEXT DEFAULT 'Success' CHECK (status IN ('Success', 'Processed', 'Refunded', 'Failed', 'Pending')),
    date TEXT DEFAULT 'Today',
    ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. SUPPORT TICKETS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id VARCHAR(50) PRIMARY KEY,
    requester TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    entity TEXT,
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Escalated', 'Resolved')),
    assigned TEXT DEFAULT 'Unassigned',
    created TEXT DEFAULT 'Just now',
    sla TEXT DEFAULT '2h left',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. RISK & FRAUD CASES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risk_cases (
    id VARCHAR(50) PRIMARY KEY,
    entity TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    detected TEXT DEFAULT 'Recent',
    evidence TEXT,
    status TEXT DEFAULT 'Under Review' CHECK (status IN ('Under Review', 'Flagged', 'Suspended', 'Monitoring')),
    assigned TEXT DEFAULT 'Risk Team',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. KYC DOCUMENT QUEUE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_queue (
    id VARCHAR(50) PRIMARY KEY,
    entity TEXT NOT NULL,
    type TEXT NOT NULL,
    entity_type TEXT DEFAULT 'Vendor' CHECK (entity_type IN ('Vendor', 'Partner')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Expiring', 'Rejected', 'Verified')),
    submitted TEXT DEFAULT 'Today',
    expiry TEXT DEFAULT '—',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. PROMOTIONS & COUPONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotions (
    id VARCHAR(50) PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    service TEXT DEFAULT 'All',
    audience TEXT DEFAULT 'All Users',
    discount TEXT NOT NULL,
    min_order NUMERIC(10,2) DEFAULT 0,
    max_discount NUMERIC(10,2) DEFAULT 0,
    used INTEGER DEFAULT 0,
    limit_count INTEGER DEFAULT 1000,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Scheduled')),
    revenue NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 12. ADMIN USERS & RBAC
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    role_id TEXT NOT NULL,
    dept TEXT,
    city_access TEXT DEFAULT 'Lucknow',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Inactive')),
    permissions JSONB DEFAULT '{}'::JSONB,
    last_active TEXT DEFAULT 'Just now',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. PRICING & SURGE RULES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id VARCHAR(50) PRIMARY KEY,
    service TEXT NOT NULL,
    city TEXT DEFAULT 'Lucknow',
    zone TEXT DEFAULT 'All Zones',
    base_fee NUMERIC(8,2) DEFAULT 25.00,
    dist_fee TEXT DEFAULT '₹8/km',
    time_fee TEXT DEFAULT '₹2/min',
    platform_fee TEXT DEFAULT '10%',
    deliv_fee NUMERIC(8,2) DEFAULT 40.00,
    min_fare NUMERIC(8,2) DEFAULT 49.00,
    max_fare NUMERIC(8,2) DEFAULT 500.00,
    version TEXT DEFAULT 'v1',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.surge_rules (
    id VARCHAR(50) PRIMARY KEY,
    zone TEXT NOT NULL,
    service TEXT NOT NULL,
    demand INTEGER DEFAULT 50,
    supply INTEGER DEFAULT 30,
    ratio NUMERIC(4,2) DEFAULT 1.5,
    multiplier TEXT DEFAULT '1.5x',
    start_time TEXT DEFAULT '18:00',
    end_time TEXT DEFAULT '21:00',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 14. MARKETPLACE PRODUCTS & CATEGORIES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    service TEXT DEFAULT 'Food',
    items INTEGER DEFAULT 0,
    vendors INTEGER DEFAULT 0,
    icon TEXT DEFAULT '🍽️',
    status TEXT DEFAULT 'Active',
    sort_order INTEGER DEFAULT 1,
    featured BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketplace_products (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    vendor TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    pack_charges NUMERIC(8,2) DEFAULT 0,
    gst TEXT DEFAULT '5%',
    status TEXT DEFAULT 'Active',
    in_stock BOOLEAN DEFAULT true,
    orders INTEGER DEFAULT 0,
    rating NUMERIC(3,1) DEFAULT 4.5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 15. SEED INITIAL DEMO DATA
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.customers (id, name, phone, email, city, orders, trips, ltv, wallet, status, risk, service, joined)
VALUES
('CUS-10291', 'Priya Sharma', '+91 98765 43210', 'priya.s@gmail.com', 'Lucknow', 147, 32, 42840, 320, 'Active', 'Low', 'Food', '12 Mar 2024'),
('CUS-10289', 'Rahul Verma', '+91 99001 23456', 'rahul.v@gmail.com', 'Lucknow', 89, 67, 28200, 0, 'Active', 'Low', 'Grocery', '08 Jan 2024'),
('CUS-10284', 'Anjali Singh', '+91 87654 32109', 'anjali.s@gmail.com', 'Lucknow', 203, 0, 58740, 1200, 'Active', 'Medium', 'Food', '22 Nov 2023'),
('CUS-10277', 'Vikram Gupta', '+91 78901 23456', 'vikram.g@gmail.com', 'Lucknow', 12, 140, 19600, 50, 'Active', 'Low', 'Rides', '15 Feb 2024'),
('CUS-10265', 'Neha Joshi', '+91 96543 21098', 'neha.j@gmail.com', 'Lucknow', 34, 8, 9880, 200, 'Suspended', 'High', 'Grocery', '03 Apr 2024')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendors (id, name, type, city, zone, status, orders, revenue, rating, kyc, payout, owner, phone, gst, pan, commission, plan)
VALUES
('VEN-2041', 'Baba Dhaba', 'Restaurant', 'Lucknow', 'Zone A', 'Active', 1847, 482300, 4.6, 'Verified', 'Weekly', 'Ramesh Gupta', '+91 98001 23456', '09ABCDE1234F1Z5', 'ABCDE1234F', 15.0, 'Premium'),
('VEN-2039', 'FreshMart Grocery', 'Grocery', 'Lucknow', 'Zone B', 'Active', 934, 214800, 4.4, 'Verified', 'Biweekly', 'Sanjay Agarwal', '+91 97654 32100', '09FGHIJ5678K2Z3', 'FGHIJ5678K', 8.0, 'Standard'),
('VEN-2037', 'Spice Garden', 'Restaurant', 'Lucknow', 'Zone C', 'Active', 2341, 612400, 4.8, 'Verified', 'Weekly', 'Poonam Jain', '+91 99123 45678', '09KLMNO9012L3Z7', 'KLMNO9012L', 15.0, 'Premium'),
('VEN-2035', 'Quick Bites', 'Restaurant', 'Lucknow', 'Zone D', 'Pending', 0, 0, 5.0, 'Pending', '—', 'Deepak Sharma', '+91 88765 43210', '—', 'PQRST1234U', 20.0, 'Basic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.partners (id, name, phone, vehicle, services, city, zone, status, earnings, rating, acceptance, completion, cancellation, kyc, vehicle_no)
VALUES
('PAR-5821', 'Suresh Pal', '+91 98765 11234', 'Motorcycle', ARRAY['Food', 'Grocery', 'Courier'], 'Lucknow', 'Zone A', 'Online', 1240, 4.7, '94%', '98%', '2%', 'Verified', 'UP32-AB-1234'),
('PAR-5819', 'Manoj Kumar', '+91 99001 22345', 'Bicycle', ARRAY['Food', 'Courier'], 'Lucknow', 'Zone B', 'Busy', 890, 4.5, '88%', '95%', '5%', 'Verified', '—'),
('PAR-5816', 'Ravi Shankar', '+91 87654 33456', 'Auto', ARRAY['Rides'], 'Lucknow', 'Zone C', 'Online', 2100, 4.8, '97%', '99%', '1%', 'Verified', 'UP32-CD-5678'),
('PAR-5813', 'Deepak Singh', '+91 78901 44567', 'Motorcycle', ARRAY['Food', 'Grocery'], 'Lucknow', 'Zone D', 'Offline', 340, 4.2, '76%', '89%', '11%', 'Pending', 'UP32-EF-9012')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_users (id, name, email, role, role_id, dept, city_access, status, permissions)
VALUES
('ADM-001', 'Rahul Sharma', 'admin@roadrider.in', 'Super Admin', 'super_admin', 'Executive Operations', 'Lucknow', 'Active', '{"all": true}'::JSONB)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 16. ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC READ ACCESS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated users to read and manage for admin panel
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Admin Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;
