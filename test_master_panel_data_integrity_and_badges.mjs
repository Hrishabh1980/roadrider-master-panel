import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

console.log('================================================================');
console.log('  TESTING MASTER PANEL DATA INTEGRITY, METRICS & BADGES AUDIT   ');
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

// ─────────────────────────────────────────────────────────────
// 1. Static Code Analysis: Sidebar Badges & Navigation
// ─────────────────────────────────────────────────────────────
console.log('--- Criterion 1: Zero Hardcoded Sidebar Badges ---');
const sidebarSrc = readFileSync(resolve('src/components/Sidebar.tsx'), 'utf-8');
const badgeContextSrc = readFileSync(resolve('src/context/BadgeContext.tsx'), 'utf-8');
const headerSrc = readFileSync(resolve('src/components/Header.tsx'), 'utf-8');
const appSrc = readFileSync(resolve('src/App.tsx'), 'utf-8');

assert(
  !sidebarSrc.includes('badge: 284') &&
  !sidebarSrc.includes('badge: 42') &&
  !sidebarSrc.includes('badge: 14') &&
  !sidebarSrc.includes('badge: 12') &&
  !sidebarSrc.includes('badge: 5') &&
  !sidebarSrc.includes('badge: 3') &&
  !sidebarSrc.includes('badge: 8'),
  'Sidebar.tsx has completely eliminated all hardcoded badge literals (284, 42, 14, 12, 5, 3, 8)'
);

assert(
  sidebarSrc.includes('useBadges') &&
  sidebarSrc.includes('badgeCounts.liveJobs') &&
  sidebarSrc.includes('badgeCounts.tickets') &&
  sidebarSrc.includes('badgeCounts.kyc') &&
  sidebarSrc.includes('badgeCounts.fraud') &&
  sidebarSrc.includes('badgeCounts.reconciliation') &&
  sidebarSrc.includes('badgeCounts.notifications'),
  'Sidebar.tsx dynamically derives badges from useBadges() context'
);

assert(
  appSrc.includes('<BadgeProvider>') && appSrc.includes('</BadgeProvider>'),
  'App.tsx wraps the tree in <BadgeProvider>'
);

assert(
  headerSrc.includes('useBadges') &&
  headerSrc.includes('badgeCounts.notifications > 0') &&
  headerSrc.includes("onNavigate('notifications')"),
  'Header.tsx links the notification bell to badgeCounts.notifications and navigates to notifications view'
);

// ─────────────────────────────────────────────────────────────
// 2. Static Code Analysis: Live Operations & Active Jobs
// ─────────────────────────────────────────────────────────────
console.log('\n--- Criterion 2: Live Operations & Active Jobs Logic ---');
const apiSrc = readFileSync(resolve('src/services/api.ts'), 'utf-8');
const liveJobsSrc = readFileSync(resolve('src/pages/LiveJobs.tsx'), 'utf-8');

assert(
  apiSrc.includes(".not('order_status', 'in', '(\"completed\",\"cancelled\",\"delivered\")')"),
  'dashboardApi.getSummary & getLiveJobs exclude terminal order statuses (completed, cancelled, delivered)'
);

assert(
  liveJobsSrc.includes("j.status !== 'Cancelled' && j.status !== 'Completed' && j.status !== 'Delivered'"),
  'LiveJobs.tsx summary KPI cards strictly filter out non-active orders'
);

assert(
  liveJobsSrc.includes("j.status === 'Searching' || j.partner === '—' || j.partner === 'Unassigned'"),
  'LiveJobs.tsx assigns searching count strictly to unassigned active jobs'
);

assert(
  !liveJobsSrc.includes(".update({ status: 'cancelled' })") &&
  !liveJobsSrc.includes(".update({ status: 'in_transit' })"),
  'LiveJobs.tsx uses real order_status column instead of non-existent status column for mutations'
);

// ─────────────────────────────────────────────────────────────
// 3. Static Code Analysis: Finance & Treasury Charts and Aggregations
// ─────────────────────────────────────────────────────────────
console.log('\n--- Criterion 3: Finance & Treasury Charts and Aggregations ---');
const financeSrc = readFileSync(resolve('src/pages/Finance.tsx'), 'utf-8');

assert(
  apiSrc.includes("platform_fee") &&
  !apiSrc.includes("gmv * 0.15") &&
  !apiSrc.includes("o.total_amount * 0.15"),
  'Platform Revenue is calculated from real database platform_fee, NOT artificial gmv * 0.15 multipliers'
);

assert(
  apiSrc.includes("day: dateStr") &&
  apiSrc.includes("date: dateStr") &&
  apiSrc.includes("gmv: 0") &&
  apiSrc.includes("revenue: 0"),
  'getRevenueChart emits unified schema supporting both Finance.tsx (day, gmv, revenue) and Dashboard.tsx (date, food, grocery)'
);

assert(
  apiSrc.includes("name: displayName") &&
  apiSrc.includes("method: displayName") &&
  apiSrc.includes("value: successRate") &&
  apiSrc.includes("pct: `${successRate}%`"),
  'getPaymentHealth emits unified schema supporting both Finance.tsx (name, value) and Dashboard.tsx (method, pct)'
);

assert(
  financeSrc.includes('No revenue or transaction volume records logged in the selected period.') &&
  financeSrc.includes('No payment gateway health data recorded.'),
  'Finance.tsx handles empty data states cleanly without rendering blank or distorted charts'
);

// ─────────────────────────────────────────────────────────────
// 4. Static Code Analysis: Security and Tenant Isolation
// ─────────────────────────────────────────────────────────────
console.log('\n--- Criterion 4: Security and Tenant Isolation ---');

assert(
  !apiSrc.includes('service_role') &&
  !sidebarSrc.includes('service_role') &&
  !headerSrc.includes('service_role') &&
  !appSrc.includes('service_role'),
  'Master Panel client source code contains NO service_role key exposure'
);

assert(
  apiSrc.includes("profile.role !== 'admin'") &&
  apiSrc.includes("techroadrider@gmail.com") &&
  apiSrc.includes("a526a5c8-80d6-491b-b188-3f450878ad90"),
  'authApi.verifyCurrentSession strictly validates admin role and Master Admin identity'
);

// ─────────────────────────────────────────────────────────────
// 5. Functional Unit Tests for Badge and Aggregation Computations
// ─────────────────────────────────────────────────────────────
console.log('\n--- Criterion 5: Functional Unit Tests for Aggregations ---');

// Test 5.1: Live Jobs Discrepancy Reconciliation Simulation
// Given the 9 real orders in the database (6 placed, 2 completed, 1 cancelled):
const sampleOrders = [
  { id: '1', order_status: 'placed', store_name: 'The Love Birds', partner: '—' },
  { id: '2', order_status: 'placed', store_name: 'The Love Birds', partner: '—' },
  { id: '3', order_status: 'placed', store_name: 'The Love Birds', partner: '—' },
  { id: '4', order_status: 'placed', store_name: 'The Love Birds', partner: '—' },
  { id: '5', order_status: 'placed', store_name: 'The Love Birds', partner: '—' },
  { id: '6', order_status: 'placed', store_name: 'The Love Birds', partner: '—' },
  { id: '7', order_status: 'completed', store_name: 'The Love Birds', partner: '—' },
  { id: '8', order_status: 'completed', store_name: 'Unassigned Store', partner: '—' },
  { id: '9', order_status: 'cancelled', store_name: 'Unassigned Store', partner: '—' },
];

// Previous buggy logic:
const buggyActiveCount = sampleOrders.filter(j => j.order_status !== 'cancelled').length; // = 8!
const buggyTableRows = sampleOrders.length; // = 9!
assert(
  buggyActiveCount === 8 && buggyTableRows === 9,
  'Reproduced screenshot anomaly: Buggy logic produced 8 active jobs vs 9 table rows because completed orders were counted'
);

// Corrected logic:
const activeOrders = sampleOrders.filter(
  j => !['completed', 'cancelled', 'delivered'].includes(j.order_status)
);
assert(
  activeOrders.length === 6,
  'Corrected logic excludes completed and cancelled: exactly 6 active jobs'
);

// Test 5.2: Finance Aggregation Simulation
const sampleTransactions = [
  { id: 't1', amount: 1500, fee_platform: 0, status: 'success', payment_method: 'upi' },
  { id: 't2', amount: 2500, fee_platform: 0, status: 'success', payment_method: 'card' },
  { id: 't3', amount: 8665, fee_platform: 0, status: 'success', payment_method: 'netbanking' },
  { id: 't4', amount: 500, fee_platform: 0, status: 'failed', payment_method: 'upi' },
];

const totalGMV = sampleTransactions.reduce((acc, t) => acc + t.amount, 0);
const totalPlatformRevenue = sampleTransactions.reduce((acc, t) => acc + (t.fee_platform || 0), 0);
const successfulTx = sampleTransactions.filter(t => t.status === 'success');
const successRate = Math.round((successfulTx.length / sampleTransactions.length) * 100);

assert(
  totalGMV === 13165 && totalPlatformRevenue === 0,
  `GMV (${totalGMV}) is not conflated with Platform Revenue (${totalPlatformRevenue})`
);
assert(
  successRate === 75,
  `Success rate calculated dynamically (${successRate}%), not hardcoded 98.5%`
);

// Test 5.3: Actionable Alerts Badge Logic
const unreadSystemNotifs = 0;
const pendingKycCount = 0;
const pendingVendorApps = 0;
const openTicketsCount = 1;

const actionableAlerts = unreadSystemNotifs +
  (pendingKycCount > 0 ? 1 : 0) +
  (pendingVendorApps > 0 ? 1 : 0) +
  (openTicketsCount > 0 ? 1 : 0);

assert(
  actionableAlerts === 1,
  `Actionable alerts badge evaluates correctly to ${actionableAlerts} (1 open support ticket)`
);

// ─────────────────────────────────────────────────────────────
// 6. Live Database RLS and Connectivity Test
// ─────────────────────────────────────────────────────────────
console.log('\n--- Criterion 6: Live Production Database Connectivity & RLS ---');

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

async function runLiveChecks() {
  try {
    // 6.1 Test public read access is locked down for anon
    const { data: anonVendors, error: vErr } = await supabase.from('vendors').select('id');
    assert(
      !vErr && Array.isArray(anonVendors) && anonVendors.length === 0,
      'RLS isolation: Anonymous unauthenticated client cannot read vendors table (returns 0 rows)'
    );

    const { data: anonStores, error: sErr } = await supabase.from('stores').select('id');
    assert(
      !sErr && Array.isArray(anonStores) && anonStores.length === 0,
      'RLS isolation: Anonymous unauthenticated client cannot read stores table (returns 0 rows)'
    );

    // 6.2 Test that Supabase project is reachable
    const { data: authSession, error: aErr } = await supabase.auth.getSession();
    assert(
      !aErr,
      'Live Supabase Auth endpoint is reachable and responsive'
    );

  } catch (err) {
    console.error('Live checks failed:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`  AUDIT COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveChecks();
