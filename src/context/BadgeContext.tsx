import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, subscribeToTable, subscribeToTables } from '../services/supabase';

export interface BadgeCounts {
  notifications: number;
  liveJobs: number;
  refunds: number;
  reconciliation: number;
  fraud: number;
  kyc: number;
  tickets: number;
  adminUsers: number;
  pendingRiders: number;
}

interface BadgeContextType {
  badgeCounts: BadgeCounts;
  loading: boolean;
  refreshBadges: () => Promise<void>;
}

const defaultCounts: BadgeCounts = {
  notifications: 0,
  liveJobs: 0,
  refunds: 0,
  reconciliation: 0,
  fraud: 0,
  kyc: 0,
  tickets: 0,
  adminUsers: 0,
  pendingRiders: 0,
};

const BadgeContext = createContext<BadgeContextType>({
  badgeCounts: defaultCounts,
  loading: false,
  refreshBadges: async () => {},
});

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>(defaultCounts);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBadgeCounts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const [
        liveJobsRes,
        ticketsRes,
        kycRes,
        riskRes,
        reconcileRes,
        notificationsRes,
        pendingVendorsRes,
        adminUsersRes,
        pendingRidersRes,
      ] = await Promise.all([
        // 1. Live Jobs: Active operational orders (not completed, cancelled, or delivered)
        supabase
          .from('orders')
          .select('id, order_status', { count: 'exact', head: true })
          .not('order_status', 'in', '("completed","cancelled","delivered")'),

        // 2. All Tickets: Open or in-progress support tickets
        supabase
          .from('support_tickets')
          .select('id, status', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress']),

        // 3. KYC Documents: Documents awaiting verification
        supabase
          .from('kyc_documents')
          .select('id, status', { count: 'exact', head: true })
          .eq('status', 'pending'),

        // 4. Fraud Flags / Risk Cases: Open or investigating risk cases
        supabase
          .from('risk_cases')
          .select('id, status', { count: 'exact', head: true })
          .in('status', ['open', 'investigating', 'under_review']),

        // 5. Reconciliation: Failed or disputed transactions requiring manual review
        supabase
          .from('transactions')
          .select('id, status', { count: 'exact', head: true })
          .in('status', ['failed', 'disputed']),

        // 6. Direct unread admin notifications
        supabase
          .from('notifications')
          .select('id, is_unread', { count: 'exact', head: true })
          .eq('is_unread', true),

        // 7. Pending vendor applications awaiting Master Admin verification
        supabase
          .from('vendors')
          .select('id, onboarding_status', { count: 'exact', head: true })
          .in('onboarding_status', ['submitted', 'in_review']),

        // 8. Active Admin Users
        supabase
          .from('admin_users')
          .select('id, status', { count: 'exact', head: true })
          .eq('status', 'Active'),

        // 9. Pending Rider applications awaiting approval
        supabase
          .from('partners')
          .select('id, kyc_status', { count: 'exact', head: true })
          .in('kyc_status', ['pending', 'under_review', 'submitted']),
      ]);

      const liveJobsCount = liveJobsRes.count ?? 0;
      const ticketsCount = ticketsRes.count ?? 0;
      const kycCount = kycRes.count ?? 0;
      const fraudCount = riskRes.count ?? 0;
      const reconciliationCount = reconcileRes.count ?? 0;
      const unreadNotifs = notificationsRes.count ?? 0;
      const pendingVendors = pendingVendorsRes.count ?? 0;
      const adminUsersCount = adminUsersRes.count ?? 0;
      const pendingRidersCount = pendingRidersRes?.count ?? 0;

      // Notifications badge combines unread system notifications + urgent actionable items
      // (pending KYC docs, pending vendor applications, pending riders, open tickets, or direct unread notices)
      const actionableAlerts = unreadNotifs + (kycCount > 0 ? 1 : 0) + (pendingVendors > 0 ? 1 : 0) + (pendingRidersCount > 0 ? 1 : 0) + (ticketsCount > 0 ? 1 : 0);

      setBadgeCounts({
        notifications: actionableAlerts,
        liveJobs: liveJobsCount,
        refunds: 0, // Refunds pending: 0 currently in DB
        reconciliation: reconciliationCount,
        fraud: fraudCount,
        kyc: kycCount,
        tickets: ticketsCount,
        adminUsers: adminUsersCount,
        pendingRiders: pendingRidersCount,
      });
    } catch (err) {
      console.error('[BadgeContext] Error fetching badge counts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadgeCounts();

    if (!isSupabaseConfigured) return;

    // Subscribe to realtime changes across tables using a single combined channel
    // All listeners are registered before .subscribe() is called
    const unsubscribe = subscribeToTables(
      ['orders', 'support_tickets', 'kyc_documents', 'risk_cases', 'transactions', 'notifications', 'vendors', 'partners'],
      () => {
        fetchBadgeCounts();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [fetchBadgeCounts]);

  return (
    <BadgeContext.Provider value={{ badgeCounts, loading, refreshBadges: fetchBadgeCounts }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  return useContext(BadgeContext);
}
