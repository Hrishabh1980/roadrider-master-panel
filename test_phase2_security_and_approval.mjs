import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

console.log('================================================================');
console.log('  TESTING PHASE 2: SECURE ADMIN AUTH & VENDOR APPROVAL AUDIT     ');
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

// ── 1. Static Code Analysis: No Demo / Mock Fallbacks in Auth ──
console.log('--- Criterion 1: Zero Mock Fallbacks in Authentication ---');
const loginSrc = readFileSync(resolve('src/pages/Login.tsx'), 'utf-8');
const apiSrc = readFileSync(resolve('src/services/api.ts'), 'utf-8');
const appSrc = readFileSync(resolve('src/App.tsx'), 'utf-8');
const vendorsPageSrc = readFileSync(resolve('src/pages/Vendors.tsx'), 'utf-8');

assert(
  !loginSrc.includes('DEMO_ROLES') &&
  !loginSrc.includes('fillDemoCredentials') &&
  !loginSrc.includes('Demo Roles — click to auto-fill') &&
  !loginSrc.includes('Fill Demo Super Admin'),
  'Login.tsx contains NO demo roles or auto-fill shortcuts'
);

assert(
  !apiSrc.includes('jwt_rr_super_admin') &&
  !apiSrc.includes('jwt_rr_assigned') &&
  !apiSrc.includes('Mock authentication with artificial delay'),
  'api.ts contains NO fake JWT generation or mock auth fallbacks'
);

assert(
  apiSrc.includes("supabase.auth.signInWithPassword") &&
  apiSrc.includes("profile.role !== 'admin'") &&
  apiSrc.includes("Administrative console access requires 'admin' role in public.profiles"),
  'api.ts strictly authenticates with Supabase and enforces role === admin'
);

assert(
  appSrc.includes('authApi.verifyCurrentSession') &&
  appSrc.includes('supabase.auth.onAuthStateChange'),
  'App.tsx verifies real Supabase session on mount and listens for auth state changes'
);

// ── 2. Static Code Analysis: Exclusive Server-Side RPC Mutations for Approval & Rejection ──
console.log('\n--- Criterion 2: Exclusive Server-Side RPC Delegation (Zero Client Mutation Fallbacks) ---');

assert(
  apiSrc.includes("supabase.rpc('admin_approve_vendor'") &&
  !apiSrc.includes("Approval mutation failed: fallback") &&
  apiSrc.includes("p_vendor_id: vendorId"),
  'vendorsApi.approve delegates mutation exclusively to admin_approve_vendor RPC'
);

assert(
  apiSrc.includes("supabase.rpc('admin_reject_vendor'") &&
  apiSrc.includes("p_rejection_reason: reason.trim()"),
  'vendorsApi.reject delegates mutation exclusively to admin_reject_vendor RPC with rejection reason'
);

// Verify that within vendorsApi.approve and vendorsApi.reject, no direct table updates exist
const approveFnBody = apiSrc.slice(apiSrc.indexOf('approve: async'), apiSrc.indexOf('reject: async'));
const rejectFnBody = apiSrc.slice(apiSrc.indexOf('reject: async'), apiSrc.indexOf('updateStatus: async'));

assert(
  !approveFnBody.includes(".from('vendors').update") &&
  !approveFnBody.includes(".from('kyc_documents').update") &&
  !approveFnBody.includes(".from('stores').update") &&
  !rejectFnBody.includes(".from('vendors').update") &&
  !rejectFnBody.includes(".from('kyc_documents').update") &&
  !rejectFnBody.includes(".from('stores').update"),
  'vendorsApi approve and reject contain NO direct table update fallbacks (atomic RPC only)'
);

assert(
  vendorsPageSrc.includes('openApproveModal') &&
  vendorsPageSrc.includes('openRejectModal') &&
  vendorsPageSrc.includes('isSubmittingAction') &&
  vendorsPageSrc.includes('Lifecycle Rule Notice'),
  'Vendors.tsx includes confirmation dialogs, double-submission protection, and lifecycle notice'
);

assert(
  !vendorsPageSrc.includes('Phase 1 Notice: Approval mutations are gated') &&
  !vendorsPageSrc.includes('Approve (Phase 2)'),
  'Vendors.tsx removed Phase 1 gated notices and wired real Phase 2 mutation flow'
);

// ── 3. Live Supabase Database Verification ──
console.log('\n--- Criterion 3: Live Production Supabase Verification ---');

const envText = readFileSync(resolve('.env'), 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runLiveTests() {
  try {
    // 1. Verify techroadrider@gmail.com existence in public.profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('email', 'techroadrider@gmail.com');

    assert(!pErr && profiles && profiles.length === 1, 'Supabase contains profile for techroadrider@gmail.com');
    const techUser = profiles ? profiles[0] : null;

    assert(
      techUser && techUser.id === 'a526a5c8-80d6-491b-b188-3f450878ad90',
      'Verified Auth User ID matches a526a5c8-80d6-491b-b188-3f450878ad90'
    );

    assert(
      techUser && techUser.role === 'admin',
      `Identified profile role is '${techUser?.role}' (Master Admin verified)`
    );

    // 2. Test trigger protection against unauthorized client role escalation/tampering
    const { data: updateData, error: updateErr } = await supabase
      .from('profiles')
      .update({ role: 'customer' })
      .eq('id', techUser?.id || '');

    assert(
      updateErr && updateErr.message.includes('Unauthorized: Users cannot change their own account role'),
      'Database trigger trg_protect_profile_role successfully blocks client-side role manipulation',
      updateErr?.message
    );

    // 3. Test auth signInWithPassword with invalid credentials
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'techroadrider@gmail.com',
      password: 'invalid_pass_verification_test',
    });

    assert(
      authErr && authErr.message.includes('Invalid login credentials'),
      'Supabase Auth rejects invalid password without falling back to demo session'
    );

    // 4. Test pending approval queue live records
    const { data: queueData, error: qErr } = await supabase
      .from('vendors')
      .select('id, business_name, onboarding_status')
      .in('onboarding_status', ['submitted', 'under_review']);

    assert(
      !qErr && Array.isArray(queueData),
      `Live pending approval queue loaded (${queueData?.length || 0} application(s) awaiting review)`
    );

  } catch (err) {
    console.error('Live test execution failed:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveTests();
