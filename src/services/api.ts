// ─────────────────────────────────────────────────────────────────────
//  RoadRider API Service Layer
//  Uses live Supabase integration or REST backend
// ─────────────────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { ROLE_PRESETS } from '../types/permissions';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '';

// Generic fetch wrapper with error handling
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      // Add auth token if present
      ...(localStorage.getItem('rr_token')
        ? { Authorization: `Bearer ${localStorage.getItem('rr_token')}` }
        : {}),
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Query helpers ────────────────────────────────────────────────────
function buildQuery(params: Record<string, string | number | undefined>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

// ─── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
  login: async (credentials: { email: string; password: string; code?: string }) => {
    if (BASE_URL) {
      const res = await request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (res.token) {
        localStorage.setItem('rr_token', res.token);
        localStorage.setItem('rr_auth_user', JSON.stringify(res.user));
      }
      return res;
    }

    if (!credentials.email || !credentials.password) {
      throw new Error('Please enter both administrative email and security key.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase authentication is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    // 1. Authenticate with Supabase Auth (no mock fallback)
    const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    if (sbError || !sbData?.user || !sbData?.session) {
      throw new Error(sbError?.message || 'Authentication failed: Invalid administrator credentials.');
    }

    const authUser = sbData.user;

    // 2. Query public.profiles to verify administrative role
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, phone, avatar_url')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      await supabase.auth.signOut();
      throw new Error(`Profile verification failed: ${profileErr.message}`);
    }

    if (!profile) {
      await supabase.auth.signOut();
      throw new Error(
        `Access Denied: No profile found for user ${authUser.email}. Please provision an admin profile row in public.profiles.`
      );
    }

    // 3. Strict role check: role MUST be 'admin'
    if (profile.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error(
        `Access Denied: Account '${authUser.email}' has role '${profile.role}'. Administrative console access requires 'admin' role in public.profiles.`
      );
    }

    // 4. Strict identity verification: Master-Panel is restricted to the designated Master Admin account or active sub-admins
    const designatedAdminEmail = 'techroadrider@gmail.com';
    const designatedAdminId = 'a526a5c8-80d6-491b-b188-3f450878ad90';
    const isSuperAdmin =
      authUser.email?.toLowerCase() === designatedAdminEmail.toLowerCase() ||
      authUser.id === designatedAdminId;

    let subAdminRecord: any = null;
    if (!isSuperAdmin) {
      const { data: subAdmin } = await supabase
        .from('admin_users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (!subAdmin || subAdmin.status !== 'Active') {
        await supabase.auth.signOut();
        throw new Error(
          `Access Denied: Account '${authUser.email}' is not an active authorized administrative user in public.admin_users.`
        );
      }
      subAdminRecord = subAdmin;
    }

    const adminUser = isSuperAdmin
      ? {
          id: profile.id,
          name: profile.full_name || 'Ashish Agarwal',
          email: profile.email || authUser.email || credentials.email,
          role: 'Super Admin',
          roleId: 'super_admin',
          department: 'Executive Operations',
          cityAccess: 'Lucknow (All Zones)',
          avatar: (profile.full_name || 'Ashish Agarwal').split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'AA',
          lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      : {
          id: profile.id,
          name: subAdminRecord.name || profile.full_name || 'Sub Admin',
          email: subAdminRecord.email || profile.email || authUser.email || credentials.email,
          role: subAdminRecord.admin_role || 'Operations Admin',
          roleId: (subAdminRecord.admin_role || 'operations_admin').toLowerCase().replace(/\s+/g, '_'),
          department: subAdminRecord.department || 'Operations',
          cityAccess: subAdminRecord.city_access || 'Lucknow',
          avatar: (subAdminRecord.name || 'SA').split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'SA',
          lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

    localStorage.setItem('rr_token', sbData.session.access_token);
    localStorage.setItem('rr_auth_user', JSON.stringify(adminUser));
    return { token: sbData.session.access_token, user: adminUser };
  },

  logout: async () => {
    localStorage.removeItem('rr_token');
    localStorage.removeItem('rr_auth_user');
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[Supabase SignOut] Error:', err);
      }
    }
  },

  getCurrentUser: () => {
    try {
      const u = localStorage.getItem('rr_auth_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  verifyCurrentSession: async (): Promise<{ isAuthenticated: boolean; user: any | null }> => {
    if (!isSupabaseConfigured) {
      return { isAuthenticated: false, user: null };
    }

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session?.user) {
        localStorage.removeItem('rr_auth_user');
        localStorage.removeItem('rr_token');
        return { isAuthenticated: false, user: null };
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileErr || !profile || profile.role !== 'admin') {
        // Active session exists, but role is not admin
        await supabase.auth.signOut();
        localStorage.removeItem('rr_auth_user');
        localStorage.removeItem('rr_token');
        return { isAuthenticated: false, user: null };
      }

      const designatedAdminEmail = 'techroadrider@gmail.com';
      const designatedAdminId = 'a526a5c8-80d6-491b-b188-3f450878ad90';
      const isSuperAdmin =
        session.user.email?.toLowerCase() === designatedAdminEmail.toLowerCase() ||
        session.user.id === designatedAdminId;

      let subAdminRecord: any = null;
      if (!isSuperAdmin) {
        const { data: subAdmin } = await supabase
          .from('admin_users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (!subAdmin || subAdmin.status !== 'Active') {
          await supabase.auth.signOut();
          localStorage.removeItem('rr_auth_user');
          localStorage.removeItem('rr_token');
          return { isAuthenticated: false, user: null };
        }
        subAdminRecord = subAdmin;
      }

      const adminUser = isSuperAdmin
        ? {
            id: profile.id,
            name: profile.full_name || 'Ashish Agarwal',
            email: profile.email || session.user.email || '',
            role: 'Super Admin',
            roleId: 'super_admin',
            department: 'Executive Operations',
            cityAccess: 'Lucknow (All Zones)',
            avatar: (profile.full_name || 'Ashish Agarwal').split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'AA',
            lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        : {
            id: profile.id,
            name: subAdminRecord.name || profile.full_name || 'Sub Admin',
            email: subAdminRecord.email || profile.email || session.user.email || '',
            role: subAdminRecord.admin_role || 'Operations Admin',
            roleId: (subAdminRecord.admin_role || 'operations_admin').toLowerCase().replace(/\s+/g, '_'),
            department: subAdminRecord.department || 'Operations',
            cityAccess: subAdminRecord.city_access || 'Lucknow',
            avatar: (subAdminRecord.name || 'SA').split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'SA',
            lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

      localStorage.setItem('rr_token', session.access_token);
      localStorage.setItem('rr_auth_user', JSON.stringify(adminUser));
      return { isAuthenticated: true, user: adminUser };
    } catch {
      return { isAuthenticated: false, user: null };
    }
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('rr_token') && !!localStorage.getItem('rr_auth_user');
  },
};
 // ─── Dashboard ────────────────────────────────────────────────────────
export const dashboardApi = {
  getSummary: async (city?: string) => {
    if (BASE_URL) return request<any>(`/dashboard/summary${buildQuery({ city })}`);
    if (isSupabaseConfigured) {
      try {
        const [ordersRes, partnersRes, ridesRes, customersRes, citiesRes, txnsRes] = await Promise.all([
          supabase.from('orders').select('id, created_at, order_status, total_amount, platform_fee, commission_amount', { count: 'exact' }),
          supabase.from('partners').select('id, is_active, status', { count: 'exact' }),
          supabase.from('rides').select('id, created_at, status', { count: 'exact' }),
          supabase.from('customers').select('id', { count: 'exact' }),
          supabase.from('cities').select('id', { count: 'exact' }),
          supabase.from('transactions').select('id, status'),
        ]);

        const orders = ordersRes.data || [];
        const totalOrders = ordersRes.count ?? orders.length;
        const totalPartners = partnersRes.count ?? (partnersRes.data?.length ?? 0);
        const totalCustomers = customersRes.count ?? (customersRes.data?.length ?? 0);
        const totalCities = citiesRes.count ?? (citiesRes.data?.length ?? 0);

        // Authoritative completed sales eligibility criteria (consistent across vendor and admin dashboards)
        const COMPLETED_SALES_STATUSES = ['handed_over', 'in_transit', 'picked_up', 'delivered', 'completed'];

        // Active operational jobs: placed, new, preparing, ready, handed_over, in_transit
        const activeJobsCount = orders.filter(o => {
          const s = String(o.order_status || '').toLowerCase();
          return s !== 'completed' && s !== 'cancelled' && s !== 'delivered' && s !== 'rejected';
        }).length;

        // Today's orders count
        const todayStr = new Date().toDateString();
        const todayOrdersCount = orders.filter(o => {
          if (!o.created_at) return false;
          return new Date(o.created_at).toDateString() === todayStr;
        }).length;

        // Gross GMV and Net Platform Revenue strictly from completed / handed-over orders
        const completedOrders = orders.filter(o =>
          COMPLETED_SALES_STATUSES.includes(String(o.order_status || '').toLowerCase())
        );
        const gmvVal = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const revVal = completedOrders.reduce((sum, o) => sum + (Number(o.platform_fee) || Number(o.commission_amount) || 0), 0);

        // Actual cancellation rate
        const cancelledCount = orders.filter(o => String(o.order_status || '').toLowerCase() === 'cancelled').length;
        const cancelRatePct = totalOrders > 0 ? `${((cancelledCount / totalOrders) * 100).toFixed(1)}%` : '0.0%';

        // Actual payment success rate
        const txns = txnsRes.data || [];
        const totalTxns = txns.length;
        const successTxns = txns.filter(t => {
          const s = String(t.status || '').toLowerCase();
          return s === 'success' || s === 'completed' || s === 'processed';
        }).length;
        const paymentSuccessPct = totalTxns > 0 ? `${Math.round((successTxns / totalTxns) * 100)}%` : '100%';

        return {
          activeJobs: activeJobsCount.toLocaleString(),
          activePartners: totalPartners.toLocaleString(),
          todayOrders: todayOrdersCount.toLocaleString(),
          gmv: gmvVal >= 100000 ? `₹${(gmvVal / 100000).toFixed(1)}L` : `₹${gmvVal.toLocaleString()}`,
          revenue: revVal >= 100000 ? `₹${(revVal / 100000).toFixed(1)}L` : `₹${revVal.toLocaleString()}`,
          cancellation: cancelRatePct,
          onTime: '100%',
          paymentSuccess: paymentSuccessPct,
          totalCustomers: totalCustomers.toLocaleString(),
          totalCities: totalCities.toLocaleString()
        };
      } catch (err) {
        console.warn('[Supabase Dashboard] Error fetching summary:', err);
      }
    }
    return {
      activeJobs: '0',
      activePartners: '0',
      todayOrders: '0',
      gmv: '₹0',
      revenue: '₹0',
      cancellation: '0.0%',
      onTime: '100%',
      paymentSuccess: '100%',
    };
  },

  getLiveJobs: async () => {
    if (BASE_URL) return request<any[]>('/dashboard/live-jobs');
    if (isSupabaseConfigured) {
      try {
        // Query only active jobs (excluding completed, cancelled, delivered)
        const [ordersRes, custRes, partnersRes, storesRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .not('order_status', 'in', '("completed","cancelled","delivered")')
            .order('created_at', { ascending: false }),
          supabase.from('customers').select('*'),
          supabase.from('partners').select('*'),
          supabase.from('stores').select('*')
        ]);
        const dbOrders = ordersRes.data;
        if (dbOrders && dbOrders.length > 0) {
          const custMap = new Map<string, string>();
          (custRes.data || []).forEach((c: any) => {
            const name = c.full_name || c.name;
            if (c.id && name) custMap.set(c.id, name);
            if (c.auth_user_id && name) custMap.set(c.auth_user_id, name);
          });
          const partnerMap = new Map<string, string>();
          (partnersRes.data || []).forEach((p: any) => {
            const name = p.full_name || p.name;
            if (p.id && name) partnerMap.set(p.id, name);
            if (p.user_id && name) partnerMap.set(p.user_id, name);
          });
          const storeMap = new Map<string, string>();
          (storesRes.data || []).forEach((s: any) => {
            const name = s.store_name || s.name;
            if (s.id && name) storeMap.set(s.id, name);
          });

          const isIdLike = (str: any) => {
            if (!str || typeof str !== 'string') return true;
            return /^(user|store|driver|merchant|customer)\s+[a-f0-9]{3,}/i.test(str) ||
                   /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(str);
          };

          return dbOrders.map((o, idx) => {
            let customer = o.customer_name?.trim();
            if (!customer && o.customer_id) customer = custMap.get(o.customer_id);
            if (!customer && o.customer && !isIdLike(o.customer)) customer = o.customer;
            if (!customer) customer = 'Customer';

            let partner = '—';
            if (o.partner_id && o.partner_id !== '—') {
              partner = partnerMap.get(o.partner_id) || '';
              if (!partner && o.partner && !isIdLike(o.partner)) partner = o.partner;
              if (!partner) partner = 'Unassigned';
            }

            const store = (o.store_id ? storeMap.get(o.store_id) : null) || (o.vendor && !isIdLike(o.vendor) ? o.vendor : 'Store');

            // Accurate active operational status mapping
            const os = String(o.order_status || o.status || '').toLowerCase();
            let status = 'Active';
            if (os === 'in_transit' || os === 'picked_up') status = 'In Transit';
            else if (os === 'preparing') status = 'In Progress';
            else if (os === 'ready' || os === 'ready_for_pickup') status = 'Ready for Pickup';
            else if (os === 'placed' || os === 'searching') {
              status = partner && partner !== '—' && partner !== 'Unassigned' ? 'In Progress' : 'Searching';
            } else if (os) {
              status = os.charAt(0).toUpperCase() + os.slice(1);
            }

            return {
              id: o.order_number || (o.id ? String(o.id).slice(0, 8).toUpperCase() : `ORD-${idx + 1}`),
              service: o.service_type ? (o.service_type.charAt(0).toUpperCase() + o.service_type.slice(1)) : (o.service || 'Food'),
              customer,
              partner: partner || '—',
              pickup: store,
              dest: o.delivery_address || 'Lucknow',
              eta: o.eta || '—',
              status,
              flag: null,
              _raw: o,
            };
          });
        }
      } catch (err) {
        console.error('[Supabase Live Jobs] Error:', err);
      }
      return [];
    }
    return [];
  },

  getRevenueChart: async (days = 7) => {
    if (BASE_URL) return request<any[]>(`/dashboard/revenue${buildQuery({ days })}`);
    if (isSupabaseConfigured) {
      try {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        const { data: orders } = await supabase
          .from('orders')
          .select('created_at, total_amount, platform_fee, commission_amount, service_type')
          .gte('created_at', sinceDate.toISOString())
          .order('created_at', { ascending: true });

        const dayMap = new Map<string, {
          date: string;
          day: string;
          food: number;
          grocery: number;
          rides: number;
          courier: number;
          gmv: number;
          revenue: number;
        }>();

        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          dayMap.set(dateStr, {
            date: dateStr,
            day: dateStr,
            food: 0,
            grocery: 0,
            rides: 0,
            courier: 0,
            gmv: 0,
            revenue: 0,
          });
        }

        const COMPLETED_SALES_STATUSES = ['handed_over', 'in_transit', 'picked_up', 'delivered', 'completed'];

        (orders || []).forEach((o: any) => {
          if (!o.created_at) return;
          const status = String(o.order_status || '').toLowerCase();
          if (!COMPLETED_SALES_STATUSES.includes(status)) return;

          const dateStr = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          const entry = dayMap.get(dateStr);
          if (entry) {
            const amt = Number(o.total_amount) || 0;
            const fee = Number(o.platform_fee) || Number(o.commission_amount) || 0;
            const st = String(o.service_type || '').toLowerCase();
            if (st.includes('groc')) entry.grocery += amt;
            else if (st.includes('ride')) entry.rides += amt;
            else if (st.includes('cour')) entry.courier += amt;
            else entry.food += amt;

            entry.gmv += amt;
            entry.revenue += fee;
          }
        });

        return Array.from(dayMap.values());
      } catch (err) {
        console.error('[Supabase Revenue Chart] Error:', err);
      }
    }
    return [];
  },

  getOrderTrend: async () => {
    if (BASE_URL) return request<any[]>('/dashboard/order-trend');
    if (isSupabaseConfigured) {
      try {
        const { data: orders } = await supabase.from('orders').select('created_at, service_type');
        const slots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        return slots.map(time => {
          const hour = parseInt(time.split(':')[0], 10);
          const inSlot = (orders || []).filter((o: any) => {
            if (!o.created_at) return false;
            const h = new Date(o.created_at).getHours();
            return h >= hour && h < hour + 2;
          });
          return {
            time,
            food: inSlot.filter((o: any) => !String(o.service_type || '').toLowerCase().includes('groc')).length,
            grocery: inSlot.filter((o: any) => String(o.service_type || '').toLowerCase().includes('groc')).length,
            rides: 0,
            courier: 0
          };
        });
      } catch (err) {
        console.error('[Supabase Order Trend] Error:', err);
      }
    }
    return [];
  },

  getPartnerAvailability: async () => {
    if (BASE_URL) return request<any[]>('/dashboard/partner-availability');
    if (isSupabaseConfigured) {
      try {
        const [partnersRes, zonesRes] = await Promise.all([
          supabase.from('partners').select('*'),
          supabase.from('zones').select('*')
        ]);
        const partners = partnersRes.data || [];
        const zones = zonesRes.data || [];
        if (zones.length > 0) {
          return zones.map((z: any) => {
            const inZone = partners.filter((p: any) => p.current_zone === z.name || p.zone_id === z.id);
            const active = inZone.filter((p: any) => p.is_active || p.status === 'Online').length;
            const offline = inZone.length - active;
            return {
              zone: z.name || z.short_code,
              available: active,
              onTrip: 0,
              offline: Math.max(0, offline),
            };
          });
        }
        return [
          { zone: 'All Zones', available: partners.filter((p: any) => p.is_active).length, onTrip: 0, offline: partners.filter((p: any) => !p.is_active).length }
        ];
      } catch (err) {
        console.error('[Supabase Partner Avail] Error:', err);
      }
    }
    return [];
  },

  getPaymentHealth: async () => {
    if (BASE_URL) return request<any[]>('/dashboard/payment-health');
    if (isSupabaseConfigured) {
      try {
        const { data: txns } = await supabase.from('transactions').select('payment_method, status');
        if (!txns || txns.length === 0) return [];

        const methodGroups = new Map<string, { total: number; success: number; fail: number }>();

        txns.forEach((t: any) => {
          let rawMethod = (t.payment_method || '').trim();
          if (!rawMethod) rawMethod = 'Other';
          const lower = rawMethod.toLowerCase();
          let displayName = rawMethod;
          if (lower === 'upi') displayName = 'UPI';
          else if (lower.includes('card')) displayName = 'Credit/Debit Card';
          else if (lower === 'neft' || lower.includes('bank')) displayName = 'Net Banking / NEFT';
          else if (lower.includes('cod') || lower.includes('cash')) displayName = 'Cash on Delivery';

          if (!methodGroups.has(displayName)) {
            methodGroups.set(displayName, { total: 0, success: 0, fail: 0 });
          }
          const g = methodGroups.get(displayName)!;
          g.total++;
          const st = (t.status || '').toLowerCase();
          if (st === 'success' || st === 'completed' || st === 'processed') {
            g.success++;
          } else {
            g.fail++;
          }
        });

        return Array.from(methodGroups.entries()).map(([displayName, g]) => {
          const successRate = g.total > 0 ? Math.round((g.success / g.total) * 100) : 100;
          return {
            method: displayName,
            name: displayName,
            total: g.total,
            success: g.success,
            fail: g.fail,
            value: successRate,
            pct: `${successRate}%`
          };
        });
      } catch (err) {
        console.error('[Supabase Payment Health] Error:', err);
      }
    }
    return [];
  },

  getCancellationTrend: async () => {
    if (BASE_URL) return request<any[]>('/dashboard/cancellation-trend');
    if (isSupabaseConfigured) {
      try {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const { data: cancelledOrders } = await supabase
          .from('orders')
          .select('created_at, cancellation_reason')
          .eq('order_status', 'cancelled');

        const dayCounts = new Map<string, number>();
        days.forEach(d => dayCounts.set(d, 0));

        (cancelledOrders || []).forEach((o: any) => {
          if (!o.created_at) return;
          const dayName = new Date(o.created_at).toLocaleDateString('en-US', { weekday: 'short' });
          if (dayCounts.has(dayName)) {
            dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
          }
        });

        return days.map(day => ({
          day,
          rate: dayCounts.get(day) || 0,
          vendor: 0,
          partner: 0,
          customer: dayCounts.get(day) || 0
        }));
      } catch (err) {
        console.error('[Supabase Cancel Trend] Error:', err);
      }
    }
    return [];
  },
};

// ─── Customers ────────────────────────────────────────────────────────
export const customersApi = {
  getAll: async (params?: { city?: string; status?: string; risk?: string; search?: string; page?: number }) => {
    if (BASE_URL) {
      return request<{ data: any[]; total: number; page: number }>(`/customers${buildQuery(params || {})}`);
    }
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('customers').select('*');
        if (params?.city) query = query.eq('city', params.city);
        if (params?.status) query = query.eq('status', params.status);
        if (params?.risk) query = query.eq('risk_level', params.risk);
        if (params?.search) query = query.or(`full_name.ilike.%${params.search}%,phone.ilike.%${params.search}%,email.ilike.%${params.search}%`);

        const { data: dbData, error } = await query;
        if (!error && Array.isArray(dbData)) {
          const mapped = dbData.map((c: any) => ({
            id: c.id ? (c.id.length > 12 ? c.id.slice(0, 8).toUpperCase() : c.id) : 'CUS-01',
            name: c.full_name || c.name || 'Customer',
            phone: c.phone || '—',
            email: c.email || '—',
            city: c.city || 'Lucknow',
            orders: c.orders || c.order_count || 0,
            trips: c.trips || c.trip_count || 0,
            ltv: typeof c.ltv === 'number' ? `₹${c.ltv.toLocaleString()}` : (c.ltv || '₹0'),
            wallet: typeof c.wallet_balance === 'number' ? `₹${c.wallet_balance.toLocaleString()}` : (c.wallet || '₹0'),
            status: c.status || 'Active',
            risk: c.risk_level || c.risk || 'Low',
            service: c.service || 'Food',
            joined: c.joined || (c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'),
            _raw: c
          }));
          return { data: mapped, total: mapped.length, page: params?.page || 1 };
        }
      } catch (err) {
        console.error('[Supabase Customers] Error:', err);
      }
      return { data: [], total: 0, page: params?.page || 1 };
    }
    return { data: [], total: 0, page: params?.page || 1 };
  },

  getById: (id: string) =>
    request<any>(`/customers/${id}`),

  getOrders: (id: string) =>
    request<any[]>(`/customers/${id}/orders`),

  getTransactions: (id: string) =>
    request<any[]>(`/customers/${id}/transactions`),

  updateStatus: async (id: string, status: 'Active' | 'Suspended' | 'Inactive') => {
    if (isSupabaseConfigured) {
      return supabase.from('customers').update({ status }).eq('id', id);
    }
    return request<any>(`/customers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  issueRefund: (id: string, orderId: string, amount: number) =>
    request<any>(`/customers/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    }),
};

// ─── Vendor Status & KYC Helpers ─────────────────────────────────────
export function formatOnboardingStatus(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Approved';
    case 'live':
      return 'Live';
    case 'rejected':
      return 'Rejected';
    case 'draft':
      return 'Draft';
    case 'in_progress':
      return 'In Progress';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  }
}

export function getStatusBadgeVariant(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'live':
      return 'active';
    case 'submitted':
    case 'under_review':
      return 'pending';
    case 'rejected':
      return 'suspended';
    case 'draft':
    case 'in_progress':
      return 'inprogress';
    default:
      return 'pending';
  }
}

export function computeKycStatus(docs?: any[]): { status: string; variant: string } {
  if (!docs || docs.length === 0) {
    return { status: 'Not Uploaded', variant: 'pending' };
  }
  const hasRejected = docs.some((d: any) => d.status === 'rejected');
  if (hasRejected) {
    return { status: 'Rejected', variant: 'suspended' };
  }
  const hasPending = docs.some((d: any) => d.status === 'pending');
  if (hasPending) {
    return { status: 'Pending Review', variant: 'pending' };
  }
  const allVerified = docs.length > 0 && docs.every((d: any) => d.status === 'verified');
  if (allVerified) {
    return { status: 'Verified', variant: 'active' };
  }
  return { status: 'Under Review', variant: 'pending' };
}

export interface MappedVendor {
  id: string; // Full UUID primary key from public.vendors.id
  userId: string;
  name: string; // for DataTable compatibility
  business_name: string;
  owner: string; // for DataTable compatibility
  owner_name: string;
  email: string;
  phone: string;
  type: string; // 'Restaurant' | 'Grocery' | 'Both'
  vendor_type: 'restaurant' | 'grocery' | 'both';
  city: string;
  locality: string;
  zone: string;
  address: string;
  status: string; // formatted display label
  onboarding_status: string; // raw database status
  onboarding_step: number;
  statusBadgeVariant: string;
  orders: number;
  revenue: string;
  revenueRaw: number;
  rating: string;
  kyc: string;
  kycBadgeVariant: string;
  payout: string;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  gst: string;
  pan: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankVerified: boolean;
  stores: any[];
  primaryStore: any | null;
  tax_information: any | null;
  bank_accounts: any | null;
  kyc_documents: any[];
  _raw: any;
}

function mapVendorRecord(v: any, orderStatsMap?: Map<string, { count: number; revenue: number }>): MappedVendor {
  const stores = Array.isArray(v.stores) ? v.stores : (v.stores ? [v.stores] : []);
  const primaryStore = stores[0] || null;
  const storeAddress = primaryStore?.store_addresses || null;

  // Aggregate orders and revenue for all outlets belonging to this vendor
  let totalOrders = 0;
  let totalRevenue = 0;
  if (orderStatsMap) {
    stores.forEach((s: any) => {
      const stats = orderStatsMap.get(s.id);
      if (stats) {
        totalOrders += stats.count;
        totalRevenue += stats.revenue;
      }
    });
  }

  // Location details from store_addresses
  const city = storeAddress?.city || (stores.length > 0 ? 'Bengaluru' : '—');
  const locality = storeAddress?.locality || storeAddress?.address_line1 || '—';
  const fullAddress = [
    storeAddress?.address_line1,
    storeAddress?.locality,
    storeAddress?.city,
    storeAddress?.state,
    storeAddress?.postal_code,
  ].filter(Boolean).join(', ');

  // Vendor type label
  let typeLabel = 'Restaurant';
  if (v.vendor_type === 'grocery' || primaryStore?.business_type === 'grocery') {
    typeLabel = 'Grocery';
  } else if (v.vendor_type === 'both') {
    typeLabel = 'Both';
  }

  // Raw status & mapped display label
  const rawStatus = v.onboarding_status || 'draft';
  const statusLabel = formatOnboardingStatus(rawStatus);
  const statusBadgeVariant = getStatusBadgeVariant(rawStatus);

  // KYC documents & computed status
  const kycDocs = Array.isArray(v.kyc_documents) ? v.kyc_documents : [];
  const kycComputed = computeKycStatus(kycDocs);

  // Tax information
  const tax = v.tax_information || null;
  const pan = tax?.pan_number || tax?.pan_masked || '—';
  const gst = tax?.gstin || '—';

  // Bank accounts
  const bank = v.bank_accounts || null;
  const bankName = bank?.bank_name || '—';
  const bankAccount = bank?.masked_account_number || bank?.account_number || '—';
  const bankIfsc = bank?.ifsc_code || '—';
  const bankVerified = Boolean(bank?.is_verified);

  const businessName = v.business_name || primaryStore?.store_name || 'Unnamed Merchant';
  const ownerName = v.owner_name || 'Merchant Partner';

  return {
    id: v.id, // Full database UUID preserved
    userId: v.user_id,
    name: businessName,
    business_name: businessName,
    owner: ownerName,
    owner_name: ownerName,
    email: v.email || primaryStore?.email || '—',
    phone: v.phone || primaryStore?.phone || '—',
    type: typeLabel,
    vendor_type: v.vendor_type || (typeLabel.toLowerCase() as any),
    city,
    locality,
    zone: locality !== '—' ? locality : 'Zone A',
    address: fullAddress || '—',
    status: statusLabel,
    onboarding_status: rawStatus,
    onboarding_step: typeof v.onboarding_step === 'number' ? v.onboarding_step : 1,
    statusBadgeVariant,
    orders: totalOrders,
    revenue: `₹${totalRevenue.toLocaleString()}`,
    revenueRaw: totalRevenue,
    rating: primaryStore?.rating ? String(primaryStore.rating) : '5.0',
    kyc: kycComputed.status,
    kycBadgeVariant: kycComputed.variant,
    payout: 'Weekly',
    terms_accepted: Boolean(v.terms_accepted),
    terms_accepted_at: v.terms_accepted_at || null,
    rejection_reason: v.rejection_reason || null,
    created_at: v.created_at,
    updated_at: v.updated_at,
    gst,
    pan,
    bankName,
    bankAccount,
    bankIfsc,
    bankVerified,
    stores,
    primaryStore,
    tax_information: tax,
    bank_accounts: bank,
    kyc_documents: kycDocs,
    _raw: v,
  };
}

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

// ─── Vendors ──────────────────────────────────────────────────────────
export const vendorsApi = {
  getAll: async (params?: { type?: string; city?: string; status?: string; kyc?: string; search?: string; page?: number }): Promise<{ data: MappedVendor[]; total: number }> => {
    if (BASE_URL) {
      return request<{ data: MappedVendor[]; total: number }>(`/vendors${buildQuery(params || {})}`);
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    let query = supabase
      .from('vendors')
      .select(VENDOR_JOIN_SELECT)
      .order('created_at', { ascending: false });

    if (params?.type && params.type !== 'All') {
      query = query.eq('vendor_type', params.type.toLowerCase());
    }

    const [vendorsRes, ordersRes] = await Promise.all([
      query,
      supabase.from('orders').select('store_id, total_amount, order_status'),
    ]);

    if (vendorsRes.error) {
      console.error('[Supabase Vendors] Error querying vendors:', vendorsRes.error.message);
      throw new Error(`Failed to load vendors: ${vendorsRes.error.message}`);
    }

    const COMPLETED_SALES_STATUSES = ['handed_over', 'in_transit', 'picked_up', 'delivered', 'completed'];
    const orderStatsMap = new Map<string, { count: number; revenue: number }>();
    if (Array.isArray(ordersRes.data)) {
      ordersRes.data.forEach((o: any) => {
        if (!o.store_id) return;
        const status = String(o.order_status || '').toLowerCase();
        const cur = orderStatsMap.get(o.store_id) || { count: 0, revenue: 0 };
        cur.count += 1;
        // Only count realized sales (handover confirmed onwards), excluding placed/preparing/cancelled
        if (COMPLETED_SALES_STATUSES.includes(status)) {
          cur.revenue += Number(o.total_amount || 0);
        }
        orderStatsMap.set(o.store_id, cur);
      });
    }

    const rawVendors = Array.isArray(vendorsRes.data) ? vendorsRes.data : [];
    let mapped = rawVendors.map((v: any) => mapVendorRecord(v, orderStatsMap));

    // Optional client-side filtering
    if (params?.status && params.status !== 'All') {
      const s = params.status.toLowerCase();
      mapped = mapped.filter((v: MappedVendor) =>
        v.onboarding_status.toLowerCase() === s || v.status.toLowerCase() === s
      );
    }
    if (params?.kyc && params.kyc !== 'All') {
      const k = params.kyc.toLowerCase();
      mapped = mapped.filter((v: MappedVendor) => v.kyc.toLowerCase().includes(k));
    }
    if (params?.city && params.city !== 'All') {
      mapped = mapped.filter((v: MappedVendor) => v.city.toLowerCase() === params.city!.toLowerCase());
    }
    if (params?.search) {
      const term = params.search.toLowerCase();
      mapped = mapped.filter((v: MappedVendor) =>
        v.id.toLowerCase().includes(term) ||
        v.business_name.toLowerCase().includes(term) ||
        v.owner_name.toLowerCase().includes(term) ||
        v.phone.toLowerCase().includes(term) ||
        v.email.toLowerCase().includes(term) ||
        v.city.toLowerCase().includes(term)
      );
    }

    return { data: mapped, total: mapped.length };
  },

  getById: async (id: string): Promise<MappedVendor | null> => {
    if (BASE_URL) {
      return request<MappedVendor>(`/vendors/${id}`);
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }

    const { data, error } = await supabase
      .from('vendors')
      .select(VENDOR_JOIN_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Supabase Vendors] Error loading vendor by ID:', error.message);
      throw new Error(`Failed to load vendor: ${error.message}`);
    }

    if (!data) return null;
    return mapVendorRecord(data);
  },

  getPendingApprovals: async (): Promise<MappedVendor[]> => {
    if (BASE_URL) {
      return request<MappedVendor[]>('/vendors/approvals/pending');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }

    const { data: rawVendors, error } = await supabase
      .from('vendors')
      .select(VENDOR_JOIN_SELECT)
      .in('onboarding_status', ['submitted', 'under_review'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase Vendors] Error loading pending approvals:', error.message);
      throw new Error(`Failed to load pending vendor approvals: ${error.message}`);
    }

    return (rawVendors || []).map((v: any) => mapVendorRecord(v));
  },

  // ─── Real Phase 2 Administrative Mutations ─────────────────────────
  approve: async (vendorId: string, storeId?: string): Promise<{ success: boolean; data: any }> => {
    if (BASE_URL) {
      return request<{ success: boolean; data: any }>(`/vendors/${vendorId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }

    // 1. Enforce active Master Admin session and profile role
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: A valid Master Admin session is required to approve vendors.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      throw new Error('Unauthorized: Only verified administrators with role "admin" can approve vendor onboarding applications.');
    }

    // 2. Call Server-Side Atomic RPC exclusively
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_approve_vendor', {
      p_vendor_id: vendorId,
    });

    if (rpcErr) {
      console.error('[Supabase Vendors] Error executing admin_approve_vendor RPC:', rpcErr);
      throw new Error(`Approval mutation failed: ${rpcErr.message}`);
    }

    if (!rpcData?.success) {
      throw new Error(rpcData?.message || 'Vendor approval failed on server.');
    }

    return { success: true, data: rpcData };
  },

  reject: async (vendorId: string, reason: string): Promise<{ success: boolean; data: any }> => {
    if (BASE_URL) {
      return request<{ success: boolean; data: any }>(`/vendors/${vendorId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Rejection reason is mandatory to reject a vendor application.');
    }

    // 1. Enforce active Master Admin session and profile role
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: A valid Master Admin session is required to reject vendors.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      throw new Error('Unauthorized: Only verified administrators with role "admin" can reject vendor onboarding applications.');
    }

    // 2. Call Server-Side Atomic RPC exclusively
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_reject_vendor', {
      p_vendor_id: vendorId,
      p_rejection_reason: reason.trim(),
    });

    if (rpcErr) {
      console.error('[Supabase Vendors] Error executing admin_reject_vendor RPC:', rpcErr);
      throw new Error(`Rejection mutation failed: ${rpcErr.message}`);
    }

    if (!rpcData?.success) {
      throw new Error(rpcData?.message || 'Vendor rejection failed on server.');
    }

    return { success: true, data: rpcData };
  },

  updateStatus: async (vendorId: string, status: string): Promise<{ success: boolean; data: any }> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: A valid Master Admin session is required.');
    }

    const { data, error } = await supabase
      .from('vendors')
      .update({
        onboarding_status: status.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update vendor status: ${error.message}`);
    }

    return { success: true, data };
  },

  suspendStore: async (storeId: string): Promise<{ success: boolean; data: any }> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: A valid Master Admin session is required.');
    }

    const { data, error } = await supabase
      .from('stores')
      .update({
        status: 'SUSPENDED',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to suspend store: ${error.message}`);
    }

    // Record administrative action in audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        action: 'STORE_SUSPENDED',
        entity_type: 'stores',
        entity_id: storeId,
        details: { store_id: storeId, suspended_at: new Date().toISOString(), status: 'SUSPENDED' },
      });
    } catch (err: any) {
      console.warn('[Audit Log] Failed to record store suspension:', err);
    }

    return { success: true, data };
  },

  unsuspendStore: async (storeId: string): Promise<{ success: boolean; data: any }> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase credentials missing.');
    }
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: A valid Master Admin session is required.');
    }

    const { data, error } = await supabase
      .from('stores')
      .update({
        status: 'OFFLINE',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to unsuspend store: ${error.message}`);
    }

    // Record administrative action in audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        action: 'STORE_UNSUSPENDED',
        entity_type: 'stores',
        entity_id: storeId,
        details: { store_id: storeId, unsuspended_at: new Date().toISOString(), status: 'OFFLINE' },
      });
    } catch (err: any) {
      console.warn('[Audit Log] Failed to record store unsuspension:', err);
    }

    return { success: true, data };
  },
};

// ─── Partners / Riders Approval Evaluation Helper ─────────────────────
export function evaluatePartnerApprovalRequirements(
  partner: any,
  vehicles: any[] = [],
  docs: any[] = []
): {
  canApprove: boolean;
  missingRequirements: string[];
  requiredDocs: { type: string; title: string; status: 'verified' | 'pending' | 'rejected' | 'missing'; docId?: string }[];
} {
  const missingRequirements: string[] = [];

  // 1. Personal info check
  const name = (partner.full_name || partner.name || '').trim();
  if (!name || name.length < 2) {
    missingRequirements.push('Rider full name is missing or invalid');
  }

  const dob = partner.date_of_birth;
  if (!dob) {
    missingRequirements.push('Date of birth is missing');
  } else {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      missingRequirements.push('Invalid date of birth format');
    } else {
      const ageDiffMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDiffMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      if (age < 18) {
        missingRequirements.push(`Rider must be at least 18 years old (current age: ${age})`);
      }
    }
  }

  if (!partner.gender) {
    missingRequirements.push('Gender is not specified');
  }

  // 2. Determine vehicle classification:
  const primaryVehicle = vehicles.find((v: any) => v.is_primary) || vehicles[0];
  const vehicleType = (primaryVehicle?.vehicle_type || partner.vehicle || '').toLowerCase();
  const isLicensed = vehicleType !== 'bicycle' && (vehicles.length > 0 || docs.some((d: any) => (d.document_type || '').includes('licence')));

  // Expected required documents
  const requiredDocTypes = isLicensed
    ? [
        { type: 'aadhaar', title: 'Aadhaar / National ID', altTypes: ['identity', 'national_id', 'id_proof'] },
        { type: 'driving_licence', title: 'Driving Licence', altTypes: ['licence', 'driving_license', 'dl'] },
        { type: 'rc', title: 'Vehicle Registration (RC)', altTypes: ['vehicle_rc', 'registration', 'rc_book'] },
        { type: 'insurance', title: 'Vehicle Insurance', altTypes: ['vehicle_insurance', 'motor_insurance'] },
        { type: 'profile_photo', title: 'Captain / Profile Photo', altTypes: ['photo', 'selfie', 'avatar'] },
      ]
    : [
        { type: 'aadhaar', title: 'Aadhaar / National ID', altTypes: ['identity', 'national_id', 'id_proof'] },
        { type: 'address_proof', title: 'Residential Address Proof', altTypes: ['utility_bill', 'voter_id'] },
        { type: 'profile_photo', title: 'Captain / Profile Photo', altTypes: ['photo', 'selfie', 'avatar'] },
      ];

  const requiredDocsStatus: { type: string; title: string; status: 'verified' | 'pending' | 'rejected' | 'missing'; docId?: string }[] = [];

  for (const req of requiredDocTypes) {
    const match = docs.find((d: any) => {
      const dt = (d.document_type || '').toLowerCase();
      if (dt === req.type) return true;
      if (req.altTypes?.includes(dt)) return true;
      return false;
    });

    if (!match) {
      missingRequirements.push(`Missing required document: ${req.title}`);
      requiredDocsStatus.push({ type: req.type, title: req.title, status: 'missing' });
    } else {
      const docStat = (match.status || 'pending').toLowerCase();
      if (docStat === 'verified' || docStat === 'approved') {
        requiredDocsStatus.push({ type: req.type, title: req.title, status: 'verified', docId: match.id });
      } else if (docStat === 'rejected') {
        missingRequirements.push(`Document rejected: ${req.title} (must be re-uploaded by rider and verified)`);
        requiredDocsStatus.push({ type: req.type, title: req.title, status: 'rejected', docId: match.id });
      } else {
        missingRequirements.push(`Document pending verification: ${req.title}`);
        requiredDocsStatus.push({ type: req.type, title: req.title, status: 'pending', docId: match.id });
      }
    }
  }

  return {
    canApprove: missingRequirements.length === 0,
    missingRequirements,
    requiredDocs: requiredDocsStatus,
  };
}

// ─── Partners / Riders API ───────────────────────────────────────────
export const partnersApi = {
  getAll: async (params?: { vehicle?: string; service?: string; status?: string; kyc?: string; city?: string; search?: string; page?: number }) => {
    if (BASE_URL) {
      return request<{ data: any[]; total: number }>(`/partners${buildQuery(params || {})}`);
    }
    if (isSupabaseConfigured) {
      try {
        const [partnersRes, vehiclesRes, servicesRes, kycDocsRes] = await Promise.all([
          supabase.from('partners').select('*').order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*'),
          supabase.from('partner_services').select('*'),
          supabase.from('kyc_documents').select('*'),
        ]);

        const dbData = partnersRes.data;
        if (!partnersRes.error && Array.isArray(dbData)) {
          const now = Date.now();
          const STALE_TIMEOUT_MS = 15 * 60 * 1000;

          // Lookup maps
          const vehicleMap = new Map<string, any[]>();
          (vehiclesRes.data || []).forEach((v: any) => {
            if (v.partner_id) {
              const list = vehicleMap.get(v.partner_id) || [];
              list.push(v);
              vehicleMap.set(v.partner_id, list);
            }
          });

          const serviceMap = new Map<string, string[]>();
          (servicesRes.data || []).forEach((s: any) => {
            if (s.partner_id && s.service_type) {
              const list = serviceMap.get(s.partner_id) || [];
              let label = s.service_type;
              if (label.includes('food')) label = 'Food';
              else if (label.includes('grocery')) label = 'Grocery';
              else if (label.includes('courier')) label = 'Courier';
              else if (label.includes('ride') || label.includes('cab')) label = 'Rides';
              if (!list.includes(label)) list.push(label);
              serviceMap.set(s.partner_id, list);
            }
          });

          const kycMap = new Map<string, any[]>();
          (kycDocsRes.data || []).forEach((d: any) => {
            if (d.partner_id) {
              const list = kycMap.get(d.partner_id) || [];
              list.push(d);
              kycMap.set(d.partner_id, list);
            }
          });

          const mapped = dbData.map((p: any) => {
            const rawStatus = (p.status || '').toLowerCase().trim();
            const lastLocTime = p.last_location_at ? new Date(p.last_location_at).getTime() : 0;
            const updatedTime = p.updated_at ? new Date(p.updated_at).getTime() : 0;
            const isLocationRecent = lastLocTime > 0 && (now - lastLocTime <= STALE_TIMEOUT_MS);
            const isUpdatedRecent = updatedTime > 0 && (now - updatedTime <= STALE_TIMEOUT_MS);

            let derivedStatus = 'Offline';
            if (rawStatus === 'busy') {
              derivedStatus = 'Busy';
            } else if (rawStatus === 'online') {
              if (isLocationRecent || isUpdatedRecent) {
                derivedStatus = 'Online';
              } else {
                derivedStatus = 'Offline';
              }
            } else if (rawStatus === 'suspended') {
              derivedStatus = 'Suspended';
            } else {
              derivedStatus = 'Offline';
            }

            const pVehicles = vehicleMap.get(p.id) || [];
            const primaryVehicle = pVehicles.find((v: any) => v.is_primary) || pVehicles[0];
            const pServices = serviceMap.get(p.id) || (p.services || ['Food', 'Courier']);
            const pDocs = kycMap.get(p.id) || [];

            // Evaluate onboarding requirements and approval readiness
            const evalResult = evaluatePartnerApprovalRequirements(p, pVehicles, pDocs);

            // Normalized KYC/Approval status
            const cleanKyc = (p.kyc_status || 'pending').trim().toLowerCase();
            let kycLabel = 'Pending';
            let kycBadgeVariant = 'pending';
            const isApproved = p.is_active === true && (cleanKyc === 'verified' || cleanKyc === 'approved');

            if (cleanKyc === 'rejected') {
              kycLabel = 'Rejected';
              kycBadgeVariant = 'suspended';
            } else if (isApproved) {
              kycLabel = 'Approved';
              kycBadgeVariant = 'active';
            } else if (cleanKyc === 'under_review' || cleanKyc === 'submitted') {
              kycLabel = 'Under Review';
              kycBadgeVariant = 'warning';
            } else {
              kycLabel = 'Pending Approval';
              kycBadgeVariant = 'pending';
            }

            const regDateStr = p.created_at
              ? new Date(p.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '—';

            const rawVehicleType = primaryVehicle?.vehicle_type || p.vehicle || 'Motorcycle';
            const vehicleFormatted = rawVehicleType.charAt(0).toUpperCase() + rawVehicleType.slice(1).toLowerCase();

            return {
              id: p.id ? (p.id.length > 12 ? p.id.slice(0, 8).toUpperCase() : p.id) : 'PAR-01',
              _dbId: p.id,
              name: p.full_name || p.name || 'Rider',
              phone: p.phone || '—',
              email: p.email || '—',
              dateOfBirth: p.date_of_birth || null,
              gender: p.gender || null,
              registrationDate: regDateStr,
              createdAt: p.created_at,
              vehicle: vehicleFormatted,
              vehicleNo: primaryVehicle?.registration_no || p.vehicle_no || p.vehicleNo || '—',
              vehicleMakeModel: primaryVehicle?.make_model || '—',
              vehicleYear: primaryVehicle?.year || null,
              vehiclesList: pVehicles,
              services: pServices,
              city: p.city || 'Lucknow',
              zone: p.zone || 'Zone A',
              status: derivedStatus,
              rawStatus,
              isActive: p.is_active === true,
              isApproved,
              isPendingApproval: !isApproved && cleanKyc !== 'rejected',
              earnings: typeof p.earnings === 'number' ? `₹${p.earnings.toLocaleString()}` : (p.earnings || '₹0'),
              rating: String(p.rating || '5.0'),
              totalJobsDone: p.total_jobs_done || 0,
              acceptance: p.acceptance || '95%',
              completion: p.completion || '98%',
              cancellation: p.cancellation || '2%',
              kyc: kycLabel,
              rawKycStatus: p.kyc_status,
              kycBadgeVariant,
              rejectionReason: p.rejection_reason || pDocs.find((d: any) => (d.status || '').toLowerCase() === 'rejected')?.rejection_reason || null,
              lastSeen: p.last_location_at || p.updated_at || null,
              documents: pDocs,
              canApprove: evalResult.canApprove,
              missingRequirements: evalResult.missingRequirements,
              requiredDocs: evalResult.requiredDocs,
              _raw: p,
            };
          });

          // Apply filters
          let filtered = mapped;

          // Status filter: All, Pending Approval, Approved, Rejected, Suspended, Online, Offline
          if (params?.status && params.status !== 'All') {
            const filterStat = params.status.toLowerCase();
            if (filterStat === 'pending approval' || filterStat === 'pending') {
              filtered = filtered.filter(m => m.isPendingApproval);
            } else if (filterStat === 'approved') {
              filtered = filtered.filter(m => m.isApproved);
            } else if (filterStat === 'rejected') {
              filtered = filtered.filter(m => m.rawKycStatus === 'rejected' || m.kyc === 'Rejected');
            } else if (filterStat === 'suspended') {
              filtered = filtered.filter(m => m.status === 'Suspended' || m.rawStatus === 'suspended');
            } else if (filterStat === 'online') {
              filtered = filtered.filter(m => m.status === 'Online');
            } else if (filterStat === 'offline') {
              filtered = filtered.filter(m => m.status === 'Offline');
            }
          }

          // Vehicle filter
          if (params?.vehicle && params.vehicle !== 'All') {
            const vFilter = params.vehicle.toLowerCase();
            filtered = filtered.filter(m => m.vehicle.toLowerCase().includes(vFilter));
          }

          // Search filter
          if (params?.search && params.search.trim()) {
            const term = params.search.toLowerCase().trim();
            filtered = filtered.filter(m =>
              m.name.toLowerCase().includes(term) ||
              m.phone.toLowerCase().includes(term) ||
              m.id.toLowerCase().includes(term) ||
              (m.vehicleNo && m.vehicleNo.toLowerCase().includes(term)) ||
              m._dbId.toLowerCase().includes(term)
            );
          }

          return { data: filtered, total: filtered.length };
        }
      } catch (err) {
        console.error('[Supabase Partners] Error:', err);
      }
      return { data: [], total: 0 };
    }
    return { data: [], total: 0 };
  },

  getById: async (id: string) => {
    if (BASE_URL) {
      return request<any>(`/partners/${id}`);
    }
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('partners').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }
    return null;
  },

  getPendingApprovals: async () => {
    const res = await partnersApi.getAll({ status: 'Pending Approval' });
    return res.data;
  },

  approve: async (partnerId: string): Promise<{ success: boolean; data?: any }> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase client is not configured.');
    }

    // 1. Verify active administrative session
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: An active administrative session is required to approve riders.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators with role "admin" can approve riders.');
    }

    // 2. Fetch live partner & docs to verify readiness
    const [pRes, vRes, dRes] = await Promise.all([
      supabase.from('partners').select('*').eq('id', partnerId).maybeSingle(),
      supabase.from('vehicles').select('*').eq('partner_id', partnerId),
      supabase.from('kyc_documents').select('*').eq('partner_id', partnerId),
    ]);

    if (!pRes.data) {
      throw new Error(`Partner ${partnerId} not found.`);
    }

    const evalResult = evaluatePartnerApprovalRequirements(pRes.data, vRes.data || [], dRes.data || []);
    if (!evalResult.canApprove) {
      throw new Error(`Cannot approve rider: ${evalResult.missingRequirements.join('; ')}`);
    }

    // 3. Attempt RPC first (atomic server-side verification)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_approve_partner', {
      p_partner_id: partnerId,
    });

    if (!rpcErr && rpcData?.success) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: session.user.id,
          action: 'PARTNER_APPROVED',
          entity_type: 'partners',
          entity_id: partnerId,
          details: { approved_by: session.user.id, via: 'rpc' },
        });
      } catch (_) {}
      return { success: true, data: rpcData };
    }

    // If RPC returned an explicit business logic exception from Postgres, surface it
    if (rpcErr && rpcErr.code !== 'PGRST202' && rpcErr.code !== '42883') {
      throw new Error(rpcErr.message || 'Rider approval was rejected by server checks.');
    }

    // Direct atomic update on partners table with resilient column fallback
    const now = new Date().toISOString();
    let updatePayload: Record<string, any> = {
      kyc_status: 'verified',
      is_active: true,
      status: 'offline', // approved and active; rider can now toggle online
      rejection_reason: null,
      verified_at: now,
      verified_by: session.user.id,
      updated_at: now,
    };

    let { data: updated, error: updateErr } = await supabase
      .from('partners')
      .update(updatePayload)
      .eq('id', partnerId)
      .select()
      .single();

    // If schema cache indicates optional column is missing, strip optional columns and retry cleanly
    if (updateErr && (updateErr.message.includes('column') || updateErr.code === 'PGRST204')) {
      const safePayload = {
        kyc_status: 'verified',
        is_active: true,
        status: 'offline',
        updated_at: now,
      };
      const retry = await supabase
        .from('partners')
        .update(safePayload)
        .eq('id', partnerId)
        .select()
        .single();

      updated = retry.data;
      updateErr = retry.error;
    }

    if (updateErr) {
      throw new Error(`Approval mutation failed: ${updateErr.message}`);
    }

    try {
      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        action: 'PARTNER_APPROVED',
        entity_type: 'partners',
        entity_id: partnerId,
        details: { approved_by: session.user.id, approved_at: now, via: 'direct' },
      });
    } catch (_) {}

    return { success: true, data: updated };
  },

  reject: async (partnerId: string, reason: string): Promise<{ success: boolean; data?: any }> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase client is not configured.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('A rejection reason is mandatory to reject a rider application.');
    }

    // 1. Verify administrative session
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.user) {
      throw new Error('Unauthorized: An active administrative session is required to reject riders.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators with role "admin" can reject riders.');
    }

    // 2. Attempt RPC first, fallback to direct update
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_reject_partner', {
      p_partner_id: partnerId,
      p_rejection_reason: reason.trim(),
    });

    if (!rpcErr && rpcData?.success) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: session.user.id,
          action: 'PARTNER_REJECTED',
          entity_type: 'partners',
          entity_id: partnerId,
          details: { reason: reason.trim(), rejected_by: session.user.id, via: 'rpc' },
        });
      } catch (_) {}
      return { success: true, data: rpcData };
    }

    if (rpcErr && rpcErr.code !== 'PGRST202' && rpcErr.code !== '42883') {
      throw new Error(rpcErr.message || 'Rider rejection was rejected by server checks.');
    }

    const now = new Date().toISOString();
    let updatePayload: Record<string, any> = {
      kyc_status: 'rejected',
      is_active: false,
      status: 'offline',
      rejection_reason: reason.trim(),
      updated_at: now,
    };

    let { data: updated, error: updateErr } = await supabase
      .from('partners')
      .update(updatePayload)
      .eq('id', partnerId)
      .select()
      .single();

    if (updateErr && (updateErr.message.includes('column') || updateErr.code === 'PGRST204')) {
      const safePayload = {
        kyc_status: 'rejected',
        is_active: false,
        status: 'offline',
        updated_at: now,
      };
      const retry = await supabase
        .from('partners')
        .update(safePayload)
        .eq('id', partnerId)
        .select()
        .single();

      updated = retry.data;
      updateErr = retry.error;
    }

    if (updateErr) {
      throw new Error(`Rejection mutation failed: ${updateErr.message}`);
    }

    try {
      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        action: 'PARTNER_REJECTED',
        entity_type: 'partners',
        entity_id: partnerId,
        details: { reason: reason.trim(), rejected_by: session.user.id, rejected_at: now, via: 'direct' },
      });
    } catch (_) {}

    return { success: true, data: updated };
  },

  suspend: async (partnerId: string, reason?: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('partners')
      .update({
        status: 'suspended',
        is_active: false,
        updated_at: now,
      })
      .eq('id', partnerId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (session?.user) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: session.user.id,
          action: 'PARTNER_SUSPENDED',
          entity_type: 'partners',
          entity_id: partnerId,
          details: { reason: reason?.trim() || null, suspended_at: now },
        });
      } catch (_) {}
    }

    return data;
  },

  unsuspend: async (partnerId: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('partners')
      .update({
        status: 'offline',
        is_active: true,
        updated_at: now,
      })
      .eq('id', partnerId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (session?.user) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: session.user.id,
          action: 'PARTNER_UNSUSPENDED',
          entity_type: 'partners',
          entity_id: partnerId,
          details: { unsuspended_at: now },
        });
      } catch (_) {}
    }

    return data;
  },

  updateStatus: async (partnerId: string, status: string) => {
    if (BASE_URL) {
      return request<any>(`/partners/${partnerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    }
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('partners')
        .update({ status: status.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('id', partnerId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  },

  getEarnings: (id: string, period?: 'today' | 'week' | 'month') =>
    request<any>(`/partners/${id}/earnings${buildQuery({ period })}`),
};

// ─── Orders ───────────────────────────────────────────────────────────
export const ordersApi = {
  getAll: async (params?: { service?: string; status?: string; payment?: string; zone?: string; city?: string; page?: number }) => {
    if (BASE_URL) {
      return request<{ data: any[]; total: number }>(`/orders${buildQuery(params || {})}`);
    }
    if (isSupabaseConfigured) {
      try {
        const [ordersRes, custRes, storesRes, vendorsRes, partnersRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('customers').select('*'),
          supabase.from('stores').select('*'),
          supabase.from('vendors').select('*'),
          supabase.from('partners').select('*'),
        ]);

        const dbData = ordersRes.data;
        if (!ordersRes.error && Array.isArray(dbData)) {
          // Lookup maps for customers, stores, vendors, partners
          const custMap = new Map<string, string>();
          (custRes.data || []).forEach((c: any) => {
            const name = c.full_name || c.name;
            if (c.id && name) custMap.set(c.id, name);
            if (c.auth_user_id && name) custMap.set(c.auth_user_id, name);
          });

          const storeMap = new Map<string, { name: string; vendor_id?: string }>();
          (storesRes.data || []).forEach((s: any) => {
            const name = s.store_name || s.name;
            if (s.id && name) storeMap.set(s.id, { name, vendor_id: s.vendor_id });
          });

          const vendorMap = new Map<string, string>();
          (vendorsRes.data || []).forEach((v: any) => {
            const name = v.business_name || v.owner_name || v.name;
            if (v.id && name) vendorMap.set(v.id, name);
            if (v.user_id && name) vendorMap.set(v.user_id, name);
          });

          const partnerMap = new Map<string, string>();
          (partnersRes.data || []).forEach((p: any) => {
            const name = p.full_name || p.name;
            if (p.id && name) partnerMap.set(p.id, name);
            if (p.user_id && name) partnerMap.set(p.user_id, name);
          });

          const isIdLike = (str: any) => {
            if (!str || typeof str !== 'string') return true;
            return /^(user|store|driver|merchant|customer)\s+[a-f0-9]{3,}/i.test(str) ||
                   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(str) ||
                   /^[0-9a-f]{8,}$/i.test(str);
          };

          const mapped = dbData.map((o: any, idx: number) => {
            // 1. Customer Name (always actual customer name, or clean fallback)
            let customer = o.customer_name?.trim();
            if (!customer && o.customer_id) customer = custMap.get(o.customer_id);
            if (!customer && o.customer && !isIdLike(o.customer)) customer = o.customer;
            if (!customer) {
              customer = 'Customer';
            }

            // 2. Store / Vendor Name
            let vendor = '';
            if (o.store_id) {
              const storeInfo = storeMap.get(o.store_id);
              if (storeInfo) {
                vendor = storeInfo.name;
                if (!vendor && storeInfo.vendor_id) {
                  vendor = vendorMap.get(storeInfo.vendor_id) || '';
                }
              }
            }
            if (!vendor && o.vendor_id) {
              vendor = vendorMap.get(o.vendor_id) || '';
            }
            if (!vendor && o.store_name) vendor = o.store_name;
            if (!vendor && o.vendor && !isIdLike(o.vendor)) vendor = o.vendor;
            if (!vendor) {
              vendor = 'Store';
            }

            // 3. Partner Name
            let partner = '—';
            const hasPartnerId = o.partner_id && o.partner_id !== '—' && o.partner_id !== 'null' && o.partner_id !== 'undefined';
            if (hasPartnerId) {
              partner = partnerMap.get(o.partner_id) || '';
              if (!partner && o.partner_name) partner = o.partner_name;
              if (!partner && o.partner && !isIdLike(o.partner)) partner = o.partner;
              if (!partner) {
                partner = 'Unassigned';
              }
            } else if (o.partner && !isIdLike(o.partner) && o.partner !== '—') {
              partner = o.partner;
            } else {
              partner = '—';
            }

            // Status normalization
            let rawStatus = o.order_status || o.status || 'Delivered';
            const sLower = String(rawStatus).toLowerCase();
            if (sLower === 'in_transit') rawStatus = 'In Transit';
            else if (sLower === 'placed' || sLower === 'new') rawStatus = 'Placed';
            else if (sLower === 'accepted') rawStatus = 'Accepted';
            else if (sLower === 'preparing') rawStatus = 'Preparing';
            else if (sLower === 'ready') rawStatus = 'Ready';
            else if (sLower === 'handed_over') rawStatus = 'Handed Over';
            else if (sLower === 'picked_up') rawStatus = 'Picked Up';
            else if (sLower === 'completed' || sLower === 'delivered') rawStatus = 'Delivered';
            else if (sLower === 'cancelled') rawStatus = 'Cancelled';
            else if (sLower === 'rejected') rawStatus = 'Rejected';
            else {
              rawStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
            }

            // Service normalization
            let rawService = o.service_type || o.service || 'Food';
            if (rawService.toLowerCase() === 'food') rawService = 'Food';
            else if (rawService.toLowerCase() === 'grocery') rawService = 'Grocery';
            else if (rawService.toLowerCase() === 'courier') rawService = 'Courier';
            else if (rawService.toLowerCase() === 'rides') rawService = 'Rides';

            // Amount
            const amtNum = o.total_amount ?? o.amount;
            const amount = typeof amtNum === 'number' ? `₹${amtNum.toLocaleString()}` : (amtNum ? `₹${amtNum}` : '₹0');

            // Created time
            const createdTime = o.created || (o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today');

            return {
              id: o.id ? (o.id.length > 12 ? o.id.slice(0, 8).toUpperCase() : o.id) : `ORD-${idx + 1}`,
              customer,
              vendor,
              partner,
              service: rawService,
              amount,
              payment: o.payment_method || o.payment || 'UPI',
              status: rawStatus,
              created: createdTime,
              eta: o.eta || (rawStatus === 'Delivered' ? 'Delivered' : '30 min'),
              zone: o.zone || 'Zone A',
              city: o.city || 'Lucknow',
              _raw: {
                ...o,
                customer,
                vendor,
                partner,
                service: rawService,
                amount,
                status: rawStatus,
              }
            };
          });

          return { data: mapped, total: mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Orders] Error:', err);
      }
      return { data: [], total: 0 };
    }
    return { data: [], total: 0 };
  },

  getById: (id: string) =>
    request<any>(`/orders/${id}`),

  getTimeline: (id: string) =>
    request<any[]>(`/orders/${id}/timeline`),

  getItems: (id: string) =>
    request<any[]>(`/orders/${id}/items`),

  issueRefund: (id: string, reason: string) =>
    request<any>(`/orders/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  raiseDispute: (id: string, reason: string) =>
    request<any>(`/orders/${id}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getHandoverSignedUrl: async (storagePath: string): Promise<string | null> => {
    if (!storagePath || !isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.storage
        .from('order-proofs')
        .createSignedUrl(storagePath, 3600);
      if (error) {
        console.error('[Supabase Storage] Error creating signed URL for handover:', error.message);
        return null;
      }
      return data?.signedUrl || null;
    } catch (e) {
      console.error('[Supabase Storage] Exception creating signed URL for handover:', e);
      return null;
    }
  },
};

// ─── Finance ──────────────────────────────────────────────────────────
export const financeApi = {
  getSummary: async () => {
    if (BASE_URL) return request<any>('/finance/summary');
    if (isSupabaseConfigured) {
      try {
        const [{ data: txns }, { data: payouts }] = await Promise.all([
          supabase.from('transactions').select('*'),
          supabase.from('payouts').select('*')
        ]);
        const totalTxns = txns?.length || 0;
        const grossGmv = txns?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
        const totalPlatformFees = txns?.reduce((sum, t) => sum + (Number(t.platform_fee) || 0), 0) || 0;
        const pendingPayoutsList = payouts?.filter(p => (p.status || '').toLowerCase() === 'pending') || [];
        const totalPendingPayouts = pendingPayoutsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const successCount = txns?.filter(t => {
          const s = (t.status || '').toLowerCase();
          return s === 'success' || s === 'completed' || s === 'processed';
        }).length || 0;
        const realSuccessRate = totalTxns > 0 ? `${Math.round((successCount / totalTxns) * 100)}%` : '100%';

        return {
          grossVolume: `₹${grossGmv.toLocaleString()}`,
          netRevenue: `₹${totalPlatformFees.toLocaleString()}`,
          processedTransactions: totalTxns.toLocaleString(),
          pendingPayouts: `₹${totalPendingPayouts.toLocaleString()}`,
          successRate: realSuccessRate,
        };
      } catch (err) {
        console.error('[Supabase Finance Summary] Error:', err);
      }
    }
    return {
      grossVolume: '₹0',
      netRevenue: '₹0',
      processedTransactions: '0',
      pendingPayouts: '₹0',
      successRate: '100%',
    };
  },

  getTransactions: async (params?: { type?: string; status?: string; method?: string; page?: number }) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/finance/transactions${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from('transactions').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        if (params?.type && params.type !== 'All Types') q = q.eq('txn_type', params.type.toLowerCase());
        if (params?.status && params.status !== 'All Status') q = q.eq('status', params.status.toLowerCase());
        const { data, count, error } = await q;
        if (!error && data) {
          const mapped = data.map((t: any) => ({
            id: t.txn_reference || (t.id ? `TXN-${String(t.id).slice(0, 6).toUpperCase()}` : 'TXN-001'),
            _dbId: t.id,
            date: t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : 'Recent',
            type: t.txn_type ? t.txn_type.charAt(0).toUpperCase() + t.txn_type.slice(1) : 'Order',
            entity: t.entity_type ? t.entity_type.charAt(0).toUpperCase() + t.entity_type.slice(1) : 'Customer',
            amount: typeof t.amount === 'number' ? `₹${t.amount.toLocaleString()}` : (t.amount ? `₹${t.amount}` : '₹0'),
            net: typeof t.net_amount === 'number' ? `₹${t.net_amount.toLocaleString()}` : (t.net_amount ? `₹${t.net_amount}` : '₹0'),
            fee: typeof t.platform_fee === 'number' ? `₹${t.platform_fee.toLocaleString()}` : '₹0',
            tax: typeof t.tax_amount === 'number' ? `₹${t.tax_amount.toLocaleString()}` : '₹0',
            status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : 'Completed',
            method: t.payment_method || 'UPI',
            ref: t.gateway_reference || t.reference_id || '—',
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Transactions] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getPayouts: async (params?: { type?: string; status?: string; page?: number }) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/finance/payouts${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from('payouts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        if (params?.status && params.status !== 'All Status') q = q.eq('status', params.status.toLowerCase());
        const { data, count, error } = await q;
        if (!error && data) {
          const mapped = data.map((p: any) => ({
            id: p.payout_reference || (p.id ? `PO-${String(p.id).slice(0, 6).toUpperCase()}` : 'PO-001'),
            _dbId: p.id,
            recipient: p.recipient_name || 'Vendor/Partner',
            amount: typeof p.amount === 'number' ? `₹${p.amount.toLocaleString()}` : (p.amount ? `₹${p.amount}` : '₹0'),
            status: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Pending',
            scheduledDate: p.scheduled_date || p.created_at || '—',
            bankRef: p.bank_reference || '—',
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Payouts] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getReconciliation: async () => {
    if (BASE_URL) return request<any>('/finance/reconciliation');
    if (isSupabaseConfigured) {
      try {
        const { data: txns } = await supabase.from('transactions').select('status, amount');
        const total = txns?.length || 0;
        const matchedTxns = txns?.filter(t => {
          const s = (t.status || '').toLowerCase();
          return s === 'completed' || s === 'success' || s === 'processed';
        }) || [];
        const discrepantTxns = txns?.filter(t => {
          const s = (t.status || '').toLowerCase();
          return s === 'failed' || s === 'disputed' || s === 'cancelled';
        }) || [];
        const unmatchedAmt = discrepantTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        return {
          totalTransactions: total,
          reconciledCount: matchedTxns.length,
          discrepancyCount: discrepantTxns.length,
          unmatchedAmount: `₹${unmatchedAmt.toLocaleString()}`,
        };
      } catch (err) {
        console.error('[Supabase Reconciliation] Error:', err);
      }
    }
    return { totalTransactions: 0, reconciledCount: 0, discrepancyCount: 0, unmatchedAmount: '₹0' };
  },

  processPayouts: () =>
    request<any>('/finance/payouts/process', { method: 'POST' }),
};

// ─── Analytics ────────────────────────────────────────────────────────
export const analyticsApi = {
  getBusiness: async (period?: string) => {
    if (BASE_URL) return request<any>(`/analytics/business${buildQuery({ period })}`);
    if (isSupabaseConfigured) {
      try {
        const [{ count: ordersCount }, { count: customersCount }, { count: vendorsCount }, { count: partnersCount }] = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }),
          supabase.from('customers').select('*', { count: 'exact', head: true }),
          supabase.from('vendors').select('*', { count: 'exact', head: true }),
          supabase.from('partners').select('*', { count: 'exact', head: true }),
        ]);
        return {
          totalOrders: ordersCount || 0,
          totalCustomers: customersCount || 0,
          totalVendors: vendorsCount || 0,
          totalPartners: partnersCount || 0,
        };
      } catch (err) {
        console.error('[Supabase Analytics] Error:', err);
      }
    }
    return { totalOrders: 0, totalCustomers: 0, totalVendors: 0, totalPartners: 0 };
  },

  getOperations: (period?: string) =>
    request<any>(`/analytics/operations${buildQuery({ period })}`),

  getCustomer: (period?: string) =>
    request<any>(`/analytics/customer${buildQuery({ period })}`),

  getVendor: (period?: string) =>
    request<any>(`/analytics/vendor${buildQuery({ period })}`),

  getPartner: (period?: string) =>
    request<any>(`/analytics/partner${buildQuery({ period })}`),

  getFinancial: (period?: string) =>
    request<any>(`/analytics/financial${buildQuery({ period })}`),
};

// ─── Risk ─────────────────────────────────────────────────────────────
export const riskApi = {
  getCases: async (params?: { severity?: string; type?: string; status?: string }) => {
    if (BASE_URL) return request<any[]>(`/risk/cases${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from('risk_cases').select('*').order('created_at', { ascending: false });
        if (params?.severity) q = q.eq('severity', params.severity.toLowerCase());
        if (params?.status) q = q.eq('status', params.status.toLowerCase());
        const { data, error } = await q;
        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id ? `RSK-${String(r.id).slice(0, 6).toUpperCase()}` : 'RSK-001',
            _dbId: r.id,
            type: r.case_type || r.type || 'Flag',
            severity: r.severity ? r.severity.charAt(0).toUpperCase() + r.severity.slice(1) : 'Medium',
            entity: r.entity_type || 'User',
            entityId: r.entity_id || '—',
            description: r.description || 'Risk flag under review',
            status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Open',
            created: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : 'Recent',
            _raw: r,
          }));
        }
      } catch (err) {
        console.error('[Supabase Risk Cases] Error:', err);
      }
    }
    return [];
  },

  getById: (id: string) =>
    request<any>(`/risk/cases/${id}`),

  updateCase: async (id: string, status: string, note?: string) => {
    if (BASE_URL) {
      return request<any>(`/risk/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
    }
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('risk_cases')
        .update({ status: status.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return { success: true };
  },
};

// ─── KYC ─────────────────────────────────────────────────────────────
export const kycApi = {
  /**
   * Fetch all KYC documents from Supabase `kyc_documents` table.
   * Joins with vendors, stores, and partners to resolve entity names.
   *
   * Table schema:
   *   id (uuid PK), vendor_id (FK), store_id (FK), partner_id (FK),
   *   document_type, storage_path, file_name, file_size_bytes, mime_type,
   *   status (non-null), rejection_reason, uploaded_at, verified_at,
   *   created_at, updated_at, expiry_date, verified_by, review_notes
   */
  getAll: async (params?: { entityType?: string; status?: string; documentType?: string; search?: string }) => {
    if (BASE_URL) {
      return request<any[]>(`/kyc/queue${buildQuery(params || {})}`);
    }

    if (isSupabaseConfigured) {
      try {
        // Fetch KYC docs + related entity tables in parallel
        let query = supabase.from('kyc_documents').select('*').order('uploaded_at', { ascending: false });

        if (params?.status) query = query.eq('status', params.status.toLowerCase());
        if (params?.documentType) query = query.ilike('document_type', `%${params.documentType}%`);

        // Entity type filter: only show rows with matching FK
        if (params?.entityType === 'Vendor') {
          query = query.not('vendor_id', 'is', null);
        } else if (params?.entityType === 'Partner') {
          query = query.not('partner_id', 'is', null);
        }

        const [kycRes, vendorsRes, storesRes, partnersRes] = await Promise.all([
          query,
          supabase.from('vendors').select('id, business_name, owner_name'),
          supabase.from('stores').select('id, store_name, vendor_id'),
          supabase.from('partners').select('id, full_name, phone'),
        ]);

        const kycData = kycRes.data;
        if (kycRes.error || !Array.isArray(kycData)) {
          console.error('[Supabase KYC] Query error:', kycRes.error?.message);
          return [];
        }

        // Build lookup maps for entity names
        const vendorMap = new Map<string, string>();
        (vendorsRes.data || []).forEach((v: any) => {
          const name = v.business_name || v.owner_name || v.name || 'Vendor';
          if (v.id) vendorMap.set(v.id, name);
        });

        const storeMap = new Map<string, { name: string; vendor_id?: string }>();
        (storesRes.data || []).forEach((s: any) => {
          const name = s.store_name || s.name || 'Store';
          if (s.id) storeMap.set(s.id, { name, vendor_id: s.vendor_id });
        });

        const partnerMap = new Map<string, string>();
        (partnersRes.data || []).forEach((p: any) => {
          const name = p.full_name || p.name || 'Partner';
          if (p.id) partnerMap.set(p.id, name);
        });

        // Map each row
        const mapped = kycData.map((d: any) => {
          // ── Resolve entity name & type ──────────────────────────────
          let entityName = 'Unknown Entity';
          let entityType: 'Vendor' | 'Partner' = 'Vendor';
          let entityRefId = '';

          if (d.partner_id) {
            entityType = 'Partner';
            entityName = partnerMap.get(d.partner_id) || 'Partner';
            entityRefId = d.partner_id.slice(0, 8).toUpperCase();
          } else if (d.vendor_id) {
            entityType = 'Vendor';
            entityName = vendorMap.get(d.vendor_id) || 'Vendor';
            entityRefId = d.vendor_id.slice(0, 8).toUpperCase();
          } else if (d.store_id) {
            entityType = 'Vendor';
            const storeInfo = storeMap.get(d.store_id);
            if (storeInfo) {
              entityName = storeInfo.name;
              if (storeInfo.vendor_id) {
                entityName = vendorMap.get(storeInfo.vendor_id) || storeInfo.name;
              }
            }
            entityRefId = d.store_id.slice(0, 8).toUpperCase();
          }

          const entity = entityRefId
            ? `${entityName} (${entityRefId})`
            : entityName;

          // Search filter (applied client-side when search spans entity name)
          if (params?.search) {
            const term = params.search.toLowerCase();
            const matchesSearch =
              entity.toLowerCase().includes(term) ||
              (d.document_type || '').toLowerCase().includes(term) ||
              (d.file_name || '').toLowerCase().includes(term) ||
              d.id.toLowerCase().includes(term);
            if (!matchesSearch) return null;
          }

          // ── Relative time from uploaded_at ─────────────────────────
          let submitted = 'Recently';
          const uploadTime = d.uploaded_at || d.created_at;
          if (uploadTime) {
            const diff = Date.now() - new Date(uploadTime).getTime();
            const mins = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            const weeks = Math.floor(diff / 604800000);
            if (weeks > 0) submitted = `${weeks}w ago`;
            else if (days > 0) submitted = `${days}d ago`;
            else if (hours > 0) submitted = `${hours}h ago`;
            else submitted = `${mins}m ago`;
          }

          // ── Format expiry_date ─────────────────────────────────────
          let expiry = '—';
          if (d.expiry_date) {
            try {
              const dt = new Date(d.expiry_date);
              expiry = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch { expiry = d.expiry_date; }
          }

          // ── Normalize status ───────────────────────────────────────
          let status = d.status || 'pending';
          status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
          if (status === 'Approved') status = 'Verified';

          // ── Check if expiring soon (within 30 days) ────────────────
          if (status === 'Verified' && d.expiry_date) {
            const daysUntilExpiry = (new Date(d.expiry_date).getTime() - Date.now()) / 86400000;
            if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
              status = 'Expiring';
            }
          }

          // ── Generate display KYC ID ────────────────────────────────
          const kycId = `KYC-${d.id.slice(0, 4).toUpperCase()}`;

          return {
            id: kycId,
            _dbId: d.id,               // actual uuid for DB operations
            entity,
            entityType,
            type: d.document_type || 'Document',
            status,
            submitted,
            expiry,
            storage_path: d.storage_path || null,
            file_name: d.file_name || null,
            mime_type: d.mime_type || null,
            file_size_bytes: d.file_size_bytes || null,
            rejection_reason: d.rejection_reason || null,
            review_notes: d.review_notes || null,
            verified_at: d.verified_at || null,
            _raw: d,
          };
        }).filter(Boolean); // remove null entries from search filtering

        return mapped;
      } catch (err) {
        console.error('[Supabase KYC] Error fetching kyc_documents:', err);
      }
    }

    return [];
  },

  getQueue: (params?: { entityType?: string; status?: string }) =>
    request<any[]>(`/kyc/queue${buildQuery(params || {})}`),

  /** Approve/verify a document — updates status in kyc_documents by uuid */
  approve: async (dbId: string) => {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      const adminUserId = session?.user?.id || 'a526a5c8-80d6-491b-b188-3f450878ad90';
      const { data, error } = await supabase
        .from('kyc_documents')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: adminUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbId)
        .select();

      if (error) {
        console.error('[KYC Approve] Error:', error.message);
        throw new Error(error.message);
      }
      return data?.[0];
    }
    return request<any>(`/kyc/${dbId}/approve`, { method: 'POST' });
  },

  /** Reject a document — updates status and rejection_reason in kyc_documents */
  reject: async (dbId: string, reason?: string) => {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      const adminUserId = session?.user?.id || 'a526a5c8-80d6-491b-b188-3f450878ad90';
      const updatePayload: Record<string, any> = {
        status: 'rejected',
        verified_by: adminUserId,
        updated_at: new Date().toISOString(),
      };
      if (reason) updatePayload.rejection_reason = reason;

      const { data, error } = await supabase
        .from('kyc_documents')
        .update(updatePayload)
        .eq('id', dbId)
        .select();

      if (error) {
        console.error('[KYC Reject] Error:', error.message);
        throw new Error(error.message);
      }
      return data?.[0];
    }
    return request<any>(`/kyc/${dbId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /** Get a public URL for a document stored in Supabase Storage */
  getDocumentUrl: (storagePath: string, bucket: string = 'kyc-documents') => {
    if (!isSupabaseConfigured || !storagePath) return null;
    if (storagePath.startsWith('http')) return storagePath;
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data?.publicUrl || null;
  },

  /**
   * Get a working URL for a document in the private kyc-documents bucket.
   * Uses multiple strategies to handle various auth/permission configurations.
   */
  getSignedDocumentUrl: async (storagePath: string, bucket: string = 'kyc-documents', expiresIn: number = 3600): Promise<string | null> => {
    if (!isSupabaseConfigured || !storagePath) return null;
    if (storagePath.startsWith('http')) return storagePath;

    // Strategy 1: SDK signed URL (works when session/anon has storage.objects SELECT)
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {}

    // Strategy 2: Direct fetch download — build blob URL
    const blobUrl = await kycApi.downloadDocumentAsBlob(storagePath, bucket);
    if (blobUrl) return blobUrl;

    // Strategy 3: Construct the URL and let the browser handle it
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
  },

  /**
   * Download a document as a Blob and return a local blob:// URL for display.
   * Tries: SDK download → direct fetch with apikey → fetch with auth token.
   */
  downloadDocumentAsBlob: async (storagePath: string, bucket: string = 'kyc-documents'): Promise<string | null> => {
    if (!isSupabaseConfigured || !storagePath) return null;

    // Attempt 1: SDK download
    try {
      const { data, error } = await supabase.storage.from(bucket).download(storagePath);
      if (!error && data && data.size > 0) {
        return URL.createObjectURL(data);
      }
    } catch {}

    // Attempt 2: Direct fetch with apikey header (bypasses SDK RLS check)
    const objectUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`;

    // Get the best available token
    let authToken = '';
    try {
      const { data: sess } = await supabase.auth.getSession();
      authToken = sess?.session?.access_token || '';
    } catch {}

    const headers: Record<string, string> = {
      'apikey': SUPABASE_ANON_KEY,
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    try {
      const res = await fetch(objectUrl, { headers });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return URL.createObjectURL(blob);
      }
    } catch {}

    // Attempt 3: Try the /authenticated/ path
    try {
      const authObjUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${storagePath}`;
      const res = await fetch(authObjUrl, { headers });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return URL.createObjectURL(blob);
      }
    } catch {}

    // Attempt 4: Try /public/ path
    try {
      const pubUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
      const res = await fetch(pubUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return URL.createObjectURL(blob);
      }
    } catch {}

    console.warn('[KYC Storage] All download strategies failed for:', storagePath);
    return null;
  },
};

// ─── Support ──────────────────────────────────────────────────────────
export const supportApi = {
  getTickets: async (params?: { status?: string; priority?: string; assignee?: string; page?: number }) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/support/tickets${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from('support_tickets').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        if (params?.status && params.status !== 'All Status') q = q.eq('status', params.status.toLowerCase());
        if (params?.priority && params.priority !== 'All Priority') q = q.eq('priority', params.priority.toLowerCase());
        const { data, count, error } = await q;
        if (!error && data) {
          const mapped = data.map((t: any) => ({
            id: t.ticket_number || (t.id ? `TCK-${String(t.id).slice(0, 6).toUpperCase()}` : 'TCK-001'),
            _dbId: t.id,
            subject: t.subject || 'Support Ticket',
            description: t.description || '—',
            category: t.category || 'General',
            status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : 'Open',
            priority: t.priority ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : 'Medium',
            requester: t.requester_type || 'User',
            created: t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : 'Recent',
            _raw: t
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Support] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getById: (id: string) =>
    request<any>(`/support/tickets/${id}`),

  assign: (id: string, agentId: string) =>
    request<any>(`/support/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    }),

  resolve: (id: string, resolution: string) =>
    request<any>(`/support/tickets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),

  escalate: (id: string) =>
    request<any>(`/support/tickets/${id}/escalate`, { method: 'POST' }),
};

// ─── Cities ───────────────────────────────────────────────────────────
export const citiesApi = {
  getAll: async () => {
    if (BASE_URL) return request<any[]>('/cities');
    if (isSupabaseConfigured) {
      try {
        const { data: dbCities, error } = await supabase.from('cities').select('*');
        if (!error && Array.isArray(dbCities)) {
          return dbCities.map((c: any) => ({
            id: c.id ? String(c.id).slice(0, 8).toUpperCase() : 'CTY-01',
            _dbId: c.id,
            name: c.name,
            status: c.status === 'active' ? 'Active' : 'Coming Soon',
            services: [
              c.food_enabled && 'Food',
              c.grocery_enabled && 'Grocery',
              c.rides_enabled && 'Rides',
              c.courier_enabled && 'Courier'
            ].filter(Boolean),
            vendors: c.vendors ?? 0,
            partners: c.partners ?? 0,
            orders: c.orders ?? '0',
            revenue: c.revenue ?? '₹0',
            zones: c.zones ?? 1
          }));
        }
      } catch (err) {
        console.error('[Supabase Cities] Error:', err);
      }
    }
    return [];
  },

  getById: (id: string) =>
    request<any>(`/cities/${id}`),

  getZones: async (cityId?: string) => {
    if (BASE_URL) return request<any[]>(`/cities/zones${cityId ? `?cityId=${cityId}` : ''}`);
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from('zones').select('*');
        if (cityId) q = q.eq('city_id', cityId);
        const { data, error } = await q;
        if (!error && Array.isArray(data)) {
          return data.map((z: any) => ({
            id: z.id ? String(z.id).slice(0, 8).toUpperCase() : 'ZON-01',
            _dbId: z.id,
            city_id: z.city_id,
            name: z.name,
            city: 'Lucknow',
            services: [
              z.food_enabled && 'Food',
              z.grocery_enabled && 'Grocery',
              z.rides_enabled && 'Rides',
              z.courier_enabled && 'Courier',
            ].filter(Boolean),
            demand: 'High',
            supply: 50,
            multiplier: '1.0x',
            status: z.is_active ? 'Active' : 'Inactive',
            _raw: z,
          }));
        }
      } catch (err) {
        console.error('[Supabase Zones] Error:', err);
      }
    }
    return [];
  },

  updateServiceAvailability: (id: string, services: string[]) =>
    request<any>(`/cities/${id}/services`, {
      method: 'PATCH',
      body: JSON.stringify({ services }),
    }),
};

// ─── Pricing ──────────────────────────────────────────────────────────
export const pricingApi = {
  getRules: async () => {
    if (BASE_URL) return request<any[]>('/pricing/rules');
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('pricing_rules').select('*');
        if (!error && data) return data;
      } catch (err) {
        console.error('[Supabase Pricing Rules] Error:', err);
      }
    }
    return [];
  },

  getSurgeRules: async () => {
    if (BASE_URL) return request<any[]>('/pricing/surge');
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('surge_rules').select('*');
        if (!error && data) return data;
      } catch (err) {
        console.error('[Supabase Surge Rules] Error:', err);
      }
    }
    return [];
  },

  getCommission: () =>
    request<any[]>('/pricing/commission'),

  updateRule: (id: string, data: any) =>
    request<any>(`/pricing/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  createSurgeRule: (data: any) =>
    request<any>('/pricing/surge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Promotions ───────────────────────────────────────────────────────
export const promotionsApi = {
  getAll: async () => {
    if (BASE_URL) return request<any[]>('/promotions');
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('promotions').select('*');
        if (!error && data) return data;
      } catch (err) {
        console.error('[Supabase Promotions] Error:', err);
      }
    }
    return [];
  },

  create: (data: any) =>
    request<any>('/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    request<any>(`/promotions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deactivate: (id: string) =>
    request<any>(`/promotions/${id}/deactivate`, { method: 'POST' }),
};

// ─── System ───────────────────────────────────────────────────────────
export const systemApi = {
  getAdminUsers: async () => {
    if (BASE_URL) return request<any[]>('/system/admins');
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'admin');
        if (!error && data) {
          return data.map((p: any) => ({
            id: p.id,
            name: p.full_name || p.name || 'Ashish Agarwal',
            email: p.email || 'techroadrider@gmail.com',
            role: 'Super Admin',
            status: 'Active',
            lastActive: p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN') : 'Recent',
            created: p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '2026-09-28',
            avatar: (p.full_name || p.email || 'Ashish Agarwal').split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'AA'
          }));
        }
      } catch (err) {
        console.error('[Supabase Admin Users] Error:', err);
      }
    }
    return [];
  },

  inviteAdmin: (data: any) =>
    request<any>('/system/admins/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAuditLogs: async (params?: { action?: string; admin?: string; page?: number }) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/system/audit-logs${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        if (params?.action) q = q.eq('action', params.action);
        const { data, count, error } = await q;
        if (!error && data) {
          const mapped = data.map((a: any) => ({
            id: a.id ? `LOG-${String(a.id).slice(0, 6).toUpperCase()}` : 'LOG-001',
            _dbId: a.id,
            action: a.action || 'System Action',
            entity: a.entity_type || 'Platform',
            user: a.user_id ? `${String(a.user_id).slice(0, 8)}...` : 'System',
            ip: a.ip_address || '127.0.0.1',
            details: typeof a.details === 'object' ? JSON.stringify(a.details) : (a.details || '—'),
            timestamp: a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : 'Recent',
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Audit Logs] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getSettings: () =>
    request<any>('/system/settings'),

  updateSettings: (data: any) =>
    request<any>('/system/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ─── Marketplace ──────────────────────────────────────────────────────
export const marketplaceApi = {
  getRestaurants: async (params?: any) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/marketplace/restaurants${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        const { data, count, error } = await supabase
          .from('stores')
          .select('*, vendors(owner_name, business_name), store_addresses(*)', { count: 'exact' })
          .eq('business_type', 'restaurant');
        if (!error && data) {
          const mapped = data.map((s: any) => ({
            id: s.id ? (s.id.length > 12 ? s.id.slice(0, 8).toUpperCase() : s.id) : 'RES-01',
            _dbId: s.id,
            name: s.store_name || 'Restaurant',
            owner: s.vendors?.owner_name || 'Owner',
            city: s.store_addresses?.[0]?.city || s.store_addresses?.city || 'Lucknow',
            zone: s.store_addresses?.[0]?.locality || s.store_addresses?.locality || 'Zone A',
            category: s.category || 'Restaurant',
            orders: s.total_orders || 0,
            revenue: s.revenue ? `₹${Number(s.revenue).toLocaleString()}` : '₹0',
            rating: String(s.rating || '—'),
            avgPrepTime: '20 min',
            cancelRate: '0%',
            status: s.status === 'ONLINE' ? 'Active' : (s.status || 'Offline'),
            kyc: 'Verified',
            plan: 'Standard',
            commissionRate: '15%',
            featured: false,
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Restaurants] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getGroceryStores: async (params?: any) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/marketplace/grocery-stores${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        const { data, count, error } = await supabase
          .from('stores')
          .select('*, vendors(owner_name, business_name), store_addresses(*)', { count: 'exact' })
          .eq('business_type', 'grocery');
        if (!error && data) {
          const mapped = data.map((s: any) => ({
            id: s.id ? (s.id.length > 12 ? s.id.slice(0, 8).toUpperCase() : s.id) : 'GRO-01',
            _dbId: s.id,
            name: s.store_name || 'Grocery Store',
            owner: s.vendors?.owner_name || 'Owner',
            city: s.store_addresses?.[0]?.city || s.store_addresses?.city || 'Lucknow',
            zone: s.store_addresses?.[0]?.locality || s.store_addresses?.locality || 'Zone A',
            skus: 0,
            orders: s.total_orders || 0,
            revenue: s.revenue ? `₹${Number(s.revenue).toLocaleString()}` : '₹0',
            rating: String(s.rating || '—'),
            deliveryTime: '30 min',
            status: s.status === 'ONLINE' ? 'Active' : (s.status || 'Offline'),
            kyc: 'Verified',
            fssai: 'Valid',
            plan: 'Standard',
            commissionRate: '8%',
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Grocery] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getProducts: async (params?: any) => {
    if (BASE_URL) return request<{ data: any[]; total: number }>(`/marketplace/products${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        const { data, count, error } = await supabase
          .from('products')
          .select('*, product_categories(name)', { count: 'exact' });
        if (!error && data) {
          const mapped = data.map((p: any) => ({
            id: p.id ? (p.id.length > 12 ? p.id.slice(0, 8).toUpperCase() : p.id) : 'PRD-01',
            _dbId: p.id,
            name: p.name || 'Product',
            vendor: p.store_id || 'Store',
            category: p.product_categories?.name || p.category || 'General',
            price: typeof p.price === 'number' ? `₹${p.price}` : (p.price || '₹0'),
            packCharges: '₹0',
            gst: '5%',
            status: p.is_available ? 'Active' : 'Inactive',
            inStock: Boolean(p.is_available),
            orders: 0,
            rating: '—',
          }));
          return { data: mapped, total: count ?? mapped.length };
        }
      } catch (err) {
        console.error('[Supabase Products] Error:', err);
      }
    }
    return { data: [], total: 0 };
  },

  getCategories: async (params?: any) => {
    if (BASE_URL) return request<any[]>(`/marketplace/categories${buildQuery(params || {})}`);
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('product_categories').select('*');
        if (!error && data) {
          return data.map((c: any, idx: number) => ({
            id: c.id ? `CAT-${String(c.id).slice(0, 4).toUpperCase()}` : `CAT-0${idx + 1}`,
            _dbId: c.id,
            name: c.name || 'Category',
            service: c.business_type === 'grocery' ? 'Grocery' : 'Food',
            items: 0,
            vendors: 0,
            icon: c.icon || '📦',
            status: c.is_active ? 'Active' : 'Inactive',
            sortOrder: c.display_order || (idx + 1),
            featured: Boolean(c.is_active),
          }));
        }
      } catch (err) {
        console.error('[Supabase Categories] Error:', err);
      }
    }
    return [];
  },

  updateProductStock: (id: string, inStock: boolean) =>
    request<any>(`/marketplace/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ inStock }),
    }),
};

// ─── Sub-Admin Management ─────────────────────────────────────────────
export const subAdminApi = {
  getAll: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[subAdminApi] Database query error on admin_users:', error.message);
        throw new Error(error.message || 'Failed to query admin_users from database');
      }

      if (Array.isArray(data)) {
        return data.map((u: any) => {
          // Normalize role name and map to canonical role preset key
          const rawRole = (u.admin_role || u.role || 'Operations Manager').trim();
          const lowerRole = rawRole.toLowerCase();

          let roleId = 'operations_manager';
          if (lowerRole.includes('master') || lowerRole.includes('super')) {
            roleId = 'super_admin';
          } else if (lowerRole.includes('finance') || lowerRole.includes('treasury')) {
            roleId = 'finance_manager';
          } else if (lowerRole.includes('risk') || lowerRole.includes('fraud') || lowerRole.includes('safety')) {
            roleId = 'risk_analyst';
          } else if (lowerRole.includes('support') || lowerRole.includes('ticket')) {
            roleId = 'support_agent';
          } else if (lowerRole.includes('city') || lowerRole.includes('expansion')) {
            roleId = 'city_manager';
          } else if (lowerRole.includes('view') || lowerRole.includes('read')) {
            roleId = 'viewer';
          } else if (lowerRole.includes('operation')) {
            roleId = 'operations_manager';
          } else {
            const underscored = lowerRole.replace(/\s+/g, '_');
            roleId = ROLE_PRESETS[underscored] ? underscored : 'operations_manager';
          }

          // Validate and parse permissions object safely
          let permissions: Record<string, any> = {};
          if (u.permissions && typeof u.permissions === 'object' && !Array.isArray(u.permissions)) {
            permissions = u.permissions;
          } else if (typeof u.permissions === 'string') {
            try {
              const parsed = JSON.parse(u.permissions);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                permissions = parsed;
              }
            } catch {}
          }

          // Fallback to role preset permissions if record does not have custom permissions
          if (Object.keys(permissions).length === 0) {
            const preset = ROLE_PRESETS[roleId] || ROLE_PRESETS.operations_manager;
            if (preset?.permissions && typeof preset.permissions === 'object') {
              permissions = JSON.parse(JSON.stringify(preset.permissions));
            }
          }

          return {
            id: u.id,
            auth_user_id: u.auth_user_id,
            name: u.name || 'Admin User',
            email: u.email || '',
            role: rawRole,
            roleId,
            department: u.department || u.dept || 'Operations',
            cityAccess: u.city_access || 'Lucknow — All Zones',
            status: (u.status === 'Suspended' || u.status === 'Pending' || u.status === 'Active') ? u.status : 'Active',
            permissions: permissions || {},
            avatar: (u.name || 'SA').split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'SA',
            createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : 'Recent',
            lastActive: u.last_active_at ? new Date(u.last_active_at).toLocaleDateString('en-IN') : 'Never',
            createdBy: u.created_by || 'Super Admin Ashish Agarwal',
            _raw: u,
          };
        });
      }
    }
    return [];
  },

  create: async (payload: {
    name: string;
    email: string;
    password?: string;
    role: string;
    department: string;
    cityAccess: string;
    permissions?: any;
  }) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data?.session?.access_token;
    const response = await fetch('/api/admin/sub-admins/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create sub-admin (${response.status})`);
    }
    return response.json();
  },

  toggleStatus: async (id: string, currentStatus: string) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data?.session?.access_token;
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    const response = await fetch('/api/admin/sub-admins/toggle-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ id, nextStatus }),
    });
    if (!response.ok) {
      // Fallback: direct table update if server endpoint is unavailable
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('admin_users')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select();
        if (error) throw new Error(error.message);
        return { success: true, data: data?.[0] };
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to toggle sub-admin status`);
    }
    return response.json();
  },

  resetPassword: async (id: string, email: string, newPassword?: string) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data?.session?.access_token;
    const response = await fetch('/api/admin/sub-admins/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ id, email, newPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to reset password`);
    }
    return response.json();
  },
};

export default {
  dashboard: dashboardApi,
  customers: customersApi,
  vendors: vendorsApi,
  partners: partnersApi,
  orders: ordersApi,
  finance: financeApi,
  analytics: analyticsApi,
  risk: riskApi,
  kyc: kycApi,
  support: supportApi,
  cities: citiesApi,
  pricing: pricingApi,
  promotions: promotionsApi,
  system: systemApi,
  marketplace: marketplaceApi,
  subAdmin: subAdminApi,
};
