import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Load Supabase credentials securely on server side only
function getSupabaseAdmin() {
  const envPath = path.resolve(__dirname, '../../Vendor-Module/supabase/functions/.env');
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey && fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    const matchKey = raw.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
    const matchUrl = raw.match(/SUPABASE_URL=(.*)/);
    if (matchKey) serviceRoleKey = matchKey[1].trim();
    if (matchUrl && !supabaseUrl) supabaseUrl = matchUrl[1].trim();
  }

  if (!supabaseUrl) {
    const localEnvPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(localEnvPath)) {
      const raw = fs.readFileSync(localEnvPath, 'utf8');
      const matchUrl = raw.match(/VITE_SUPABASE_URL=(.*)/);
      if (matchUrl) supabaseUrl = matchUrl[1].trim();
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin credentials not configured on server');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const SUPER_ADMIN_EMAIL = 'techroadrider@gmail.com';
const SUPER_ADMIN_ID = 'a526a5c8-80d6-491b-b188-3f450878ad90';

async function verifySuperAdmin(req: IncomingMessage, supabaseAdmin: any) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authorization header missing or invalid' };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { ok: false, status: 401, error: 'Invalid or expired authentication session' };
  }

  const isSuper = user.id === SUPER_ADMIN_ID || user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (!isSuper) {
    return { ok: false, status: 403, error: 'Unauthorized: Only the designated Super Admin can manage sub-admin accounts' };
  }

  return { ok: true, user };
}

export async function handleSubAdminRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/admin/sub-admins/')) {
    return false;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const authCheck = await verifySuperAdmin(req, supabaseAdmin);
    if (!authCheck.ok) {
      sendJson(res, authCheck.status || 401, { error: authCheck.error });
      return true;
    }

    const superAdmin = authCheck.user;
    const body = await parseBody(req);
    const subPath = url.replace('/api/admin/sub-admins/', '').split('?')[0];

    // ── 1. CREATE SUB-ADMIN ──────────────────────────────────────────────
    if (subPath === 'create') {
      const { name, email, password, role, department, cityAccess, permissions } = body;

      if (!name || !name.trim()) {
        sendJson(res, 400, { error: 'Full name is required' });
        return true;
      }
      if (!email || !email.includes('@')) {
        sendJson(res, 400, { error: 'A valid email address is required' });
        return true;
      }
      if (!password || password.length < 6) {
        sendJson(res, 400, { error: 'Initial password must be at least 6 characters' });
        return true;
      }

      // Security check: Prevent privilege escalation
      if (
        role?.toLowerCase().includes('super') ||
        role?.toLowerCase().includes('master')
      ) {
        sendJson(res, 403, { error: 'Cannot assign Super Admin privileges to sub-admins' });
        return true;
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if email already belongs to Super Admin
      if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
        sendJson(res, 400, { error: 'Cannot create a sub-admin with the Super Admin email' });
        return true;
      }

      // 1. Create or fetch auth user via Supabase Auth Admin
      let authUserId: string | null = null;
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: name.trim(),
          role: 'admin',
          admin_role: role || 'Operations Admin',
        },
      });

      if (createErr) {
        // If user already exists in Auth, retrieve and update password
        if (createErr.message?.toLowerCase().includes('already registered')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const existing = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
          if (existing) {
            authUserId = existing.id;
            await supabaseAdmin.auth.admin.updateUserById(authUserId, {
              password: password,
              user_metadata: {
                full_name: name.trim(),
                role: 'admin',
                admin_role: role || 'Operations Admin',
              },
            });
          } else {
            sendJson(res, 400, { error: createErr.message });
            return true;
          }
        } else {
          sendJson(res, 400, { error: createErr.message });
          return true;
        }
      } else {
        authUserId = createData.user.id;
      }

      if (!authUserId) {
        sendJson(res, 500, { error: 'Failed to establish auth user identity' });
        return true;
      }

      // 2. Ensure profile exists with role: 'admin'
      await supabaseAdmin.from('profiles').upsert({
        id: authUserId,
        email: cleanEmail,
        full_name: name.trim(),
        role: 'admin',
      });

      // 3. Upsert admin_users table record
      const { data: adminUserRow, error: adminUserErr } = await supabaseAdmin
        .from('admin_users')
        .upsert(
          {
            auth_user_id: authUserId,
            name: name.trim(),
            email: cleanEmail,
            admin_role: role || 'Operations Admin',
            department: department || 'Ground Operations',
            city_access: cityAccess || 'Lucknow',
            status: 'Active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'auth_user_id' }
        )
        .select()
        .single();

      if (adminUserErr) {
        console.error('[subAdminServer] admin_users insert error:', adminUserErr);
        sendJson(res, 500, { error: adminUserErr.message });
        return true;
      }

      // 4. Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        user_id: superAdmin.id,
        action: 'SUB_ADMIN_CREATED',
        entity_type: 'admin_user',
        entity_id: adminUserRow.id,
        details: {
          name: name.trim(),
          email: cleanEmail,
          role,
          department,
          cityAccess,
          authUserId,
        },
      });

      sendJson(res, 200, {
        success: true,
        message: `Sub-admin ${name.trim()} successfully created`,
        data: adminUserRow,
      });
      return true;
    }

    // ── 2. TOGGLE SUB-ADMIN STATUS ──────────────────────────────────────
    if (subPath === 'toggle-status') {
      const { id, nextStatus } = body;
      if (!id) {
        sendJson(res, 400, { error: 'Sub-admin ID is required' });
        return true;
      }

      const { data: targetAdmin } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('id', id)
        .single();

      if (!targetAdmin) {
        sendJson(res, 404, { error: 'Sub-admin record not found' });
        return true;
      }

      if (targetAdmin.auth_user_id === SUPER_ADMIN_ID || targetAdmin.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        sendJson(res, 403, { error: 'The Super Admin account cannot be suspended or modified here' });
        return true;
      }

      const statusVal = nextStatus === 'Active' ? 'Active' : 'Suspended';
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('admin_users')
        .update({ status: statusVal, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (updErr) {
        sendJson(res, 500, { error: updErr.message });
        return true;
      }

      // Record in audit logs
      await supabaseAdmin.from('audit_logs').insert({
        user_id: superAdmin.id,
        action: statusVal === 'Active' ? 'SUB_ADMIN_ACTIVATED' : 'SUB_ADMIN_SUSPENDED',
        entity_type: 'admin_user',
        entity_id: id,
        details: { targetEmail: targetAdmin.email, status: statusVal },
      });

      sendJson(res, 200, { success: true, data: updated });
      return true;
    }

    // ── 3. RESET PASSWORD ───────────────────────────────────────────────
    if (subPath === 'reset-password') {
      const { id, email, newPassword } = body;
      if (!id || !newPassword || newPassword.length < 6) {
        sendJson(res, 400, { error: 'New password must be at least 6 characters' });
        return true;
      }

      const { data: targetAdmin } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('id', id)
        .single();

      if (!targetAdmin) {
        sendJson(res, 404, { error: 'Sub-admin record not found' });
        return true;
      }

      if (targetAdmin.auth_user_id === SUPER_ADMIN_ID || targetAdmin.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        sendJson(res, 403, { error: 'Cannot reset Super Admin password via this endpoint' });
        return true;
      }

      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
        targetAdmin.auth_user_id,
        { password: newPassword }
      );

      if (resetErr) {
        sendJson(res, 500, { error: resetErr.message });
        return true;
      }

      // Record in audit logs
      await supabaseAdmin.from('audit_logs').insert({
        user_id: superAdmin.id,
        action: 'SUB_ADMIN_PASSWORD_RESET',
        entity_type: 'admin_user',
        entity_id: id,
        details: { targetEmail: targetAdmin.email },
      });

      sendJson(res, 200, { success: true, message: 'Password successfully updated' });
      return true;
    }

    sendJson(res, 404, { error: `Endpoint /api/admin/sub-admins/${subPath} not found` });
    return true;
  } catch (err: any) {
    console.error('[subAdminServer] Server exception:', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
    return true;
  }
}
