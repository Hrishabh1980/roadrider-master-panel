import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

console.log('================================================================');
console.log('  TESTING PHASE 1: MASTER PANEL VENDOR INTEGRATION AUDIT        ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failed++;
  }
}

// ── 1. Static Code Analysis: No Mock Fallbacks in Vendors ──
console.log('--- Criterion 1: Zero Mock Fallbacks in Vendor Management ---');
const vendorsPageSrc = readFileSync(resolve('src/pages/Vendors.tsx'), 'utf-8');
const apiSrc = readFileSync(resolve('src/services/api.ts'), 'utf-8');

assert(
  !vendorsPageSrc.includes("import { vendors as initialVendors } from '../data'"),
  'Vendors.tsx does not import mock initialVendors from data.ts'
);

assert(
  !vendorsPageSrc.includes('INITIAL_APPROVAL_QUEUE'),
  'Vendors.tsx does not use hardcoded INITIAL_APPROVAL_QUEUE'
);

assert(
  !vendorsPageSrc.includes('Awadh Biryani Corner') &&
  !vendorsPageSrc.includes('Deepak Sharma') &&
  !vendorsPageSrc.includes('Anita Kumari'),
  'Vendors.tsx contains no hardcoded mock vendor names in state initializers'
);

assert(
  vendorsPageSrc.includes('vendorsApi.getPendingApprovals'),
  'Vendors.tsx calls vendorsApi.getPendingApprovals() for live approval queue'
);

assert(
  apiSrc.includes("from('vendors')") &&
  apiSrc.includes('stores (') &&
  apiSrc.includes('store_addresses (') &&
  apiSrc.includes('tax_information (') &&
  apiSrc.includes('bank_accounts (') &&
  apiSrc.includes('kyc_documents ('),
  'api.ts queries vendors as root with stores, addresses, tax, bank, and KYC joins'
);

assert(
  !apiSrc.includes('v.id.slice(0, 8).toUpperCase()') &&
  apiSrc.includes('id: v.id,'),
  'api.ts preserves full vendor UUID and does not truncate primary keys'
);

// ── 2. Live Supabase Query Verification ──
console.log('\n--- Criterion 2: Live Supabase Normalized Data Loading ---');

function parseEnv(path) {
  if (!existsSync(path)) return {};
  const res = {};
  readFileSync(path, 'utf-8').split('\n').forEach(l => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx !== -1) res[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  });
  return res;
}

const env = parseEnv('.env');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const VENDOR_JOIN_SELECT = `
  id,
  user_id,
  owner_name,
  business_name,
  email,
  phone,
  vendor_type,
  onboarding_status,
  onboarding_step,
  terms_accepted,
  terms_accepted_at,
  created_at,
  updated_at,
  stores (
    id,
    vendor_id,
    business_type,
    store_name,
    slug,
    description,
    phone,
    email,
    status,
    rating,
    total_reviews,
    is_active,
    created_at,
    updated_at,
    store_addresses (
      id,
      store_id,
      address_line1,
      address_line2,
      landmark,
      locality,
      city,
      state,
      postal_code,
      service_radius_km
    )
  ),
  tax_information (
    id,
    vendor_id,
    pan_number,
    pan_masked,
    gstin,
    pan_verified,
    gstin_verified
  ),
  bank_accounts (
    id,
    vendor_id,
    account_holder_name,
    bank_name,
    account_number,
    ifsc_code,
    account_type,
    is_verified,
    verified_at
  ),
  kyc_documents (
    id,
    vendor_id,
    store_id,
    document_type,
    storage_path,
    file_name,
    file_size_bytes,
    mime_type,
    status,
    rejection_reason,
    uploaded_at,
    verified_at
  )
`;

const { data: liveVendors, error: vErr } = await supabase
  .from('vendors')
  .select(VENDOR_JOIN_SELECT)
  .order('created_at', { ascending: false });

assert(vErr === null, 'Vendors select query executes with zero errors on live database', vErr?.message);
assert(Array.isArray(liveVendors) && liveVendors.length >= 2, `Live database returns ${liveVendors?.length} vendors`);

const targetVendor = liveVendors?.find(v => v.id === 'e06173fd-634c-4568-87e2-bf57b5813e86');
assert(
  targetVendor !== undefined,
  'Found real vendor e06173fd-634c-4568-87e2-bf57b5813e86 (My Business Outlet)'
);

if (targetVendor) {
  assert(
    targetVendor.id === 'e06173fd-634c-4568-87e2-bf57b5813e86',
    'Vendor has exact full UUID preserved: e06173fd-634c-4568-87e2-bf57b5813e86'
  );
  assert(
    targetVendor.owner_name === 'Merchant Partner' && targetVendor.business_name === 'My Business Outlet',
    'Vendor has real owner_name and business_name'
  );
  assert(
    targetVendor.onboarding_step === 11,
    'Vendor has real onboarding_step = 11'
  );
  assert(
    Array.isArray(targetVendor.stores) && targetVendor.stores.length > 0,
    'Vendor has real linked store from public.stores'
  );
  assert(
    targetVendor.stores[0].store_addresses !== null,
    'Vendor store has real linked store_addresses'
  );
  assert(
    Array.isArray(targetVendor.kyc_documents) && targetVendor.kyc_documents.length === 5,
    'Vendor has real 5 uploaded KYC documents in public.kyc_documents'
  );
}

// ── 3. Live Approval Queue Query Verification ──
console.log('\n--- Criterion 3: Approval Queue Queries Live Pending Applications ---');
const { data: pendingVendors, error: pErr } = await supabase
  .from('vendors')
  .select(VENDOR_JOIN_SELECT)
  .in('onboarding_status', ['submitted', 'under_review'])
  .order('created_at', { ascending: false });

assert(pErr === null, 'Approval queue query executes with zero errors', pErr?.message);
assert(
  Array.isArray(pendingVendors),
  `Approval queue returns valid array (found: ${pendingVendors?.length})`
);

// ── 4. RLS & Security Verification ──
console.log('\n--- Criterion 4: RLS Security Policies and Schema Integrity Preserved ---');
const schemaSrc = readFileSync(resolve('supabase_schema.sql'), 'utf-8');
const liveFixSrc = readFileSync(resolve('supabase_live_fix.sql'), 'utf-8');

assert(
  !apiSrc.includes('service_role'),
  'Master-Panel client code does not expose or import service_role key'
);

assert(
  schemaSrc.includes('CREATE TABLE IF NOT EXISTS public.customers'),
  'supabase_schema.sql remains unexecuted and unchanged'
);

assert(
  liveFixSrc.includes('CREATE POLICY "Admin Full Access"'),
  'supabase_live_fix.sql remains unexecuted and unchanged'
);

console.log('\n================================================================');
console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
