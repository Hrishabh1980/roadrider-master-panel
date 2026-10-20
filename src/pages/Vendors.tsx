import React, { useState, useEffect, useCallback } from 'react';
import {
  SectionHeader,
  DataTable,
  Badge,
  FilterBar,
  Drawer,
  DrawerSection,
  DetailRow,
  Btn,
  Tabs,
  StatGroup,
  AlertBanner,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { vendorsApi, type MappedVendor } from '../services/api';
import {
  Check,
  X,
  Store,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Copy,
  FileText,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

const DRAWER_TABS = ['Overview', 'Stores & Outlets', 'KYC Documents', 'Tax & Banking'];

export default function Vendors({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [filterType, setFilterType] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterKyc, setFilterKyc] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Primary live vendors list query
  const { data: apiResponse, loading, error, refetch } = useApi(
    () => vendorsApi.getAll({
      type: filterType,
      city: filterCity,
      status: filterStatus,
      kyc: filterKyc,
      search: searchQuery,
    }),
    { data: [], total: 0 },
    [filterType, filterCity, filterStatus, filterKyc, searchQuery]
  );

  const [vendorsList, setVendorsList] = useState<MappedVendor[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<MappedVendor[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MappedVendor | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [view, setView] = useState<'list' | 'approvals'>('list');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Phase 2: Administrative Approval & Rejection Modal State
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject';
    vendor: MappedVendor;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync loaded vendors list
  useEffect(() => {
    if (apiResponse?.data) {
      setVendorsList(apiResponse.data);
    }
  }, [apiResponse]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch real approval queue from Supabase (status in submitted or under_review)
  const fetchApprovalQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const pending = await vendorsApi.getPendingApprovals();
      setApprovalQueue(pending);
    } catch (err: any) {
      console.error('[Vendors] Failed to load approval queue:', err.message);
      setQueueError(err.message || 'Failed to load approval queue from database.');
      setApprovalQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovalQueue();
  }, [fetchApprovalQueue]);

  const handleRefresh = () => {
    refetch();
    fetchApprovalQueue();
    showToast('Syncing vendor records with Supabase...');
  };

  const openApproveModal = (vendor: MappedVendor) => {
    setActionError(null);
    setActionModal({ type: 'approve', vendor });
  };

  const openRejectModal = (vendor: MappedVendor) => {
    setActionError(null);
    setRejectionReason('');
    setActionModal({ type: 'reject', vendor });
  };

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    const { type, vendor } = actionModal;

    if (type === 'reject' && !rejectionReason.trim()) {
      setActionError('Please specify the rejection reason for the audit log.');
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    try {
      if (type === 'approve') {
        await vendorsApi.approve(vendor.id, vendor.primaryStore?.id);
        showToast(`Vendor "${vendor.business_name}" approved! Store activated (OFFLINE).`);
      } else {
        await vendorsApi.reject(vendor.id, rejectionReason.trim());
        showToast(`Vendor "${vendor.business_name}" rejected. Reason recorded in KYC log.`);
      }

      setActionModal(null);
      setRejectionReason('');
      fetchApprovalQueue();
      refetch();

      if (selected && selected.id === vendor.id) {
        setSelected({
          ...selected,
          onboarding_status: type === 'approve' ? 'approved' : 'rejected',
          status: type === 'approve' ? 'Approved' : 'Rejected',
        });
      }
    } catch (err: any) {
      console.error(`[Vendors] Error during vendor ${type}:`, err);
      setActionError(err.message || `Database mutation failed during ${type}.`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSuspendStore = async (storeId: string) => {
    const reason = window.prompt('Enter reason for suspending this store:', 'Administrative review / Operations suspension');
    if (reason === null) return;
    try {
      await vendorsApi.suspendStore(storeId);
      showToast('Store has been suspended (offline and blocked from taking orders).');
      setSelected((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stores: prev.stores.map((s: any) => (s.id === storeId ? { ...s, status: 'SUSPENDED', is_active: false } : s)),
        };
      });
      refetch();
    } catch (err: any) {
      showToast(`Error suspending store: ${err.message}`);
    }
  };

  const handleUnsuspendStore = async (storeId: string) => {
    if (!window.confirm('Reactivate this store? It will be set to OFFLINE (can go online when eligible).')) return;
    try {
      await vendorsApi.unsuspendStore(storeId);
      showToast('Store unsuspended successfully (status set to OFFLINE).');
      setSelected((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stores: prev.stores.map((s: any) => (s.id === storeId ? { ...s, status: 'OFFLINE', is_active: true } : s)),
        };
      });
      refetch();
    } catch (err: any) {
      showToast(`Error unsuspending store: ${err.message}`);
    }
  };

  // DataTable column definitions with full UUID preservation
  const columns = [
    { key: 'id', label: 'VENDOR UUID', width: '220px' },
    { key: 'business_name', label: 'BUSINESS / OUTLET' },
    { key: 'owner_name', label: 'OWNER' },
    { key: 'type', label: 'TYPE', width: '110px' },
    { key: 'city', label: 'LOCATION' },
    { key: 'status', label: 'ONBOARDING STATUS', width: '150px' },
    { key: 'step', label: 'STEP', width: '85px' },
    { key: 'orders', label: 'ORDERS', width: '80px' },
    { key: 'revenue', label: 'REVENUE', width: '100px' },
    { key: 'kyc', label: 'KYC', width: '120px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const rows = vendorsList.map((v) => ({
    ...v,
    id: (
      <div className="flex items-center gap-1.5 group">
        <span
          className="text-[11px] font-mono text-[#333] select-all bg-[#F8F8F8] px-2 py-0.5 rounded border border-[#E8E8E8] max-w-[190px] truncate"
          title={v.id}
        >
          {v.id}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(v.id, 'Vendor UUID');
          }}
          className="p-1 hover:bg-[#E8E8E8] rounded text-[#9C9A9A] hover:text-black cursor-pointer transition-colors"
          title="Copy full UUID"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    ),
    business_name: (
      <div>
        <span className="font-semibold text-black block">{v.business_name}</span>
        {v.primaryStore && v.primaryStore.store_name !== v.business_name && (
          <span className="text-[10px] text-[#9C9A9A] block">
            Store: {v.primaryStore.store_name}
          </span>
        )}
      </div>
    ),
    owner_name: (
      <div>
        <span className="text-xs font-medium text-black block">{v.owner_name}</span>
        <span className="text-[10px] font-mono text-[#9C9A9A]">{v.phone}</span>
      </div>
    ),
    type: <Badge variant={v.type === 'Restaurant' ? 'food' : 'grocery'} label={v.type} />,
    city: (
      <div>
        <span className="text-xs text-[#464646] font-medium block">{v.city}</span>
        {v.locality !== '—' && v.locality !== v.city && (
          <span className="text-[10px] text-[#9C9A9A] block">{v.locality}</span>
        )}
      </div>
    ),
    status: <Badge variant={v.statusBadgeVariant} label={v.status} showDot />,
    step: <span className="text-xs font-mono font-bold text-[#464646]">{v.onboarding_step}/11</span>,
    orders: <span className="font-bold font-mono-data text-xs">{v.orders}</span>,
    revenue: <span className="font-bold font-mono-data text-xs">{v.revenue}</span>,
    kyc: <Badge variant={v.kycBadgeVariant} label={v.kyc} />,
    actions: (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSelected(v);
          setDrawerOpen(true);
        }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer"
      >
        View
      </button>
    ),
    _raw: v,
  }));

  // Restrict operational city filter to Lucknow only
  const cityOptions = ['Lucknow'];

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader
        title="Vendors"
        subtitle={`${vendorsList.length} live database vendor${vendorsList.length === 1 ? '' : 's'} · ${approvalQueue.length} pending review`}
      >
        <Btn small onClick={handleRefresh}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading || loadingQueue ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <button
          onClick={() => setView(view === 'list' ? 'approvals' : 'list')}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
            view === 'approvals'
              ? 'bg-black text-white border-black'
              : 'border-[#9C9A9A] text-black hover:border-black bg-white'
          }`}
        >
          {view === 'approvals' ? '← All Vendors' : `Approval Queue (${approvalQueue.length})`}
        </button>
      </SectionHeader>

      {view === 'approvals' ? (
        <div>
          <AlertBanner type="info">
            {approvalQueue.length} vendor application{approvalQueue.length === 1 ? '' : 's'} awaiting review in Supabase (status: 'submitted' or 'under_review').
          </AlertBanner>

          {loadingQueue && (
            <div className="border border-[#E8E8E8] rounded-xl p-12 text-center mt-4 bg-white">
              <Loader2 className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
              <p className="text-xs text-[#464646] font-bold">Querying pending vendor applications from Supabase...</p>
            </div>
          )}

          {queueError && !loadingQueue && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-center mt-4 text-red-800">
              <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <p className="text-xs font-bold">{queueError}</p>
              <div className="mt-3">
                <Btn small onClick={fetchApprovalQueue}>
                  Retry Query
                </Btn>
              </div>
            </div>
          )}

          {!loadingQueue && !queueError && approvalQueue.length === 0 && (
            <div className="border border-[#E8E8E8] rounded-xl p-12 text-center mt-4 bg-white">
              <p className="text-xs text-[#9C9A9A] font-bold">
                ✓ Approval queue is clear. No pending vendors currently in 'submitted' or 'under_review' status.
              </p>
            </div>
          )}

          {!loadingQueue && !queueError && approvalQueue.length > 0 && (
            <div className="mt-4 space-y-4">
              {approvalQueue.map((v) => (
                <div key={v.id} className="border border-[#E8E8E8] rounded-xl p-5 bg-white shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[11px] font-mono font-bold text-[#464646] bg-[#F5F5F5] px-2 py-0.5 rounded border border-[#E8E8E8] select-all"
                          title="Full Vendor UUID"
                        >
                          {v.id}
                        </span>
                        <button
                          onClick={() => copyToClipboard(v.id, 'Vendor UUID')}
                          className="p-1 hover:bg-[#E8E8E8] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                          title="Copy UUID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <Badge variant={v.statusBadgeVariant} label={`Status: ${v.status}`} showDot />
                        <span className="text-xs font-mono font-semibold text-[#666]">
                          Step {v.onboarding_step}/11
                        </span>
                      </div>
                      <h3 className="text-base font-black text-black">{v.business_name}</h3>
                      <p className="text-xs text-[#464646] mt-0.5">
                        {v.type} · {v.city}{v.locality !== '—' && v.locality !== v.city ? ` (${v.locality})` : ''} · Owner:{' '}
                        <span className="font-semibold text-black">{v.owner_name}</span> · Phone:{' '}
                        <span className="font-mono">{v.phone}</span>
                      </p>
                      <p className="text-[10px] text-[#9C9A9A] mt-1">
                        Registered:{' '}
                        {new Date(v.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {v.terms_accepted_at
                          ? ` · Terms Accepted: ${new Date(v.terms_accepted_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {/* Business Outlet */}
                    <div className="border border-[#E8E8E8] rounded-xl p-3 bg-[#FAFAFA]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9C9A9A] mb-1">
                        Business Outlet
                      </p>
                      <p className="text-xs font-bold text-black truncate">
                        {v.primaryStore?.store_name || v.business_name}
                      </p>
                      <p className="text-[11px] text-[#464646] mt-0.5">
                        Outlet: <span className="font-semibold">{v.primaryStore?.status || 'OFFLINE'}</span>
                      </p>
                    </div>

                    {/* KYC Documents */}
                    <div className="border border-[#E8E8E8] rounded-xl p-3 bg-[#FAFAFA]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9C9A9A] mb-1">
                        KYC Documents
                      </p>
                      <p className="text-xs font-bold text-black mb-1">
                        {v.kyc_documents.length} File{v.kyc_documents.length === 1 ? '' : 's'} Uploaded
                      </p>
                      <Badge variant={v.kycBadgeVariant} label={v.kyc} />
                    </div>

                    {/* Bank Details */}
                    <div className="border border-[#E8E8E8] rounded-xl p-3 bg-[#FAFAFA]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9C9A9A] mb-1">
                        Bank Details
                      </p>
                      <p className="text-xs font-bold text-black truncate">{v.bankName}</p>
                      <p className="text-[11px] text-[#464646] font-mono mt-0.5">
                        {v.bankAccount !== '—' ? v.bankAccount : 'Awaiting details'}
                      </p>
                    </div>

                    {/* Tax & GSTIN */}
                    <div className="border border-[#E8E8E8] rounded-xl p-3 bg-[#FAFAFA]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9C9A9A] mb-1">
                        Tax / Identifiers
                      </p>
                      <p className="text-xs font-bold font-mono text-black">
                        PAN: {v.pan !== '—' && v.pan !== '' ? v.pan : 'Not provided'}
                      </p>
                      <p className="text-[11px] text-[#464646] font-mono mt-0.5">
                        GST: {v.gst !== '—' && v.gst !== '' ? v.gst : 'Not registered'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#F0F0F0]">
                    <div className="flex gap-2">
                      <Btn
                        small
                        variant="secondary"
                        onClick={() => {
                          setSelected(v);
                          setDrawerOpen(true);
                          setTab('KYC Documents');
                        }}
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" /> View KYC Files ({v.kyc_documents.length})
                      </Btn>
                      <Btn
                        small
                        variant="ghost"
                        onClick={() => {
                          setSelected(v);
                          setDrawerOpen(true);
                          setTab('Overview');
                        }}
                      >
                        Inspect Full Profile →
                      </Btn>
                    </div>
                    <div className="flex gap-2">
                      <Btn
                        variant="primary"
                        small
                        disabled={isSubmittingAction}
                        onClick={() => openApproveModal(v)}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                      </Btn>
                      <Btn
                        small
                        danger
                        disabled={isSubmittingAction}
                        onClick={() => openRejectModal(v)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Reject
                      </Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <FilterBar
            filters={[
              {
                label: 'Type',
                options: ['All', 'Restaurant', 'Grocery', 'Both'],
              },
              {
                label: 'City',
                options: ['All', ...cityOptions],
              },
              {
                label: 'Status',
                options: ['All', 'Submitted', 'Under Review', 'Approved', 'Live', 'Draft', 'Rejected'],
              },
              {
                label: 'KYC',
                options: ['All', 'Verified', 'Pending', 'Rejected', 'Not Uploaded'],
              },
            ]}
          />

          {loading && (
            <div className="border border-[#E8E8E8] rounded-xl p-12 text-center bg-white my-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
              <p className="text-xs text-[#464646] font-bold">Loading live vendors from Supabase...</p>
            </div>
          )}

          {error && !loading && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-center my-4 text-red-800">
              <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <p className="text-xs font-bold">{error}</p>
              <div className="mt-3">
                <Btn small onClick={handleRefresh}>
                  Retry Query
                </Btn>
              </div>
            </div>
          )}

          {!loading && !error && vendorsList.length === 0 && (
            <div className="border border-[#E8E8E8] rounded-xl p-12 text-center bg-white my-4">
              <p className="text-xs text-[#9C9A9A] font-bold">
                No vendor records found in Supabase matching the current filter.
              </p>
            </div>
          )}

          {!loading && !error && vendorsList.length > 0 && (
            <DataTable
              columns={columns}
              rows={rows}
              onRowClick={(row) => {
                setSelected((row as any)._raw);
                setDrawerOpen(true);
              }}
            />
          )}
        </>
      )}

      {/* Detailed Vendor Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.business_name || 'Vendor Profile'}
        subtitle={`${selected?.id} · ${selected?.type} · Step ${selected?.onboarding_step}/11`}
        badge={
          selected ? (
            <div className="flex gap-1.5">
              <Badge variant={selected.statusBadgeVariant} label={selected.status} showDot />
              <Badge variant={selected.kycBadgeVariant} label={selected.kyc} />
            </div>
          ) : null
        }
      >
        {selected && (
          <>
            <Tabs tabs={DRAWER_TABS} active={tab} onChange={setTab} />

            {/* TAB 1: OVERVIEW */}
            {tab === 'Overview' && (
              <>
                <DrawerSection title="VENDOR IDENTITY & CREDENTIALS">
                  <div className="flex items-center justify-between py-1 border-b border-[#F5F5F5]">
                    <span className="text-xs text-[#9C9A9A] font-semibold">Vendor ID</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-black select-all">{selected.id}</span>
                      <button
                        onClick={() => copyToClipboard(selected.id, 'Vendor UUID')}
                        className="p-1 hover:bg-[#E8E8E8] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                        title="Copy full UUID"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <DetailRow label="Auth User ID" value={selected.userId} mono />
                  <DetailRow label="Business Name" value={selected.business_name} />
                  <DetailRow label="Owner Name" value={selected.owner_name} />
                  <DetailRow label="Contact Phone" value={selected.phone} mono />
                  <DetailRow label="Contact Email" value={selected.email} />
                  <DetailRow label="Registered Address" value={selected.address} />
                  <DetailRow
                    label="Onboarding Progress"
                    value={`Step ${selected.onboarding_step} of 11 (${selected.status})`}
                  />
                  <DetailRow
                    label="Terms Accepted"
                    value={
                      selected.terms_accepted ? (
                        <span className="text-emerald-700 font-semibold">
                          Yes {selected.terms_accepted_at ? `(${new Date(selected.terms_accepted_at).toLocaleDateString()})` : ''}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Not accepted</span>
                      )
                    }
                  />
                  {selected.rejection_reason && (
                    <DetailRow label="Rejection Reason" value={selected.rejection_reason} />
                  )}
                </DrawerSection>

                <DrawerSection title="REAL DATABASE METRICS">
                  <StatGroup
                    items={[
                      { label: 'Outlets / Stores', value: String(selected.stores.length) },
                      { label: 'Total Orders', value: String(selected.orders) },
                      { label: 'Total Revenue', value: selected.revenue, highlight: true },
                      { label: 'Store Rating', value: `${selected.rating} ★` },
                    ]}
                  />
                </DrawerSection>
              </>
            )}

            {/* TAB 2: STORES & OUTLETS */}
            {tab === 'Stores & Outlets' && (
              <DrawerSection title={`REGISTERED STORES (${selected.stores.length})`}>
                {selected.stores.length === 0 ? (
                  <p className="text-xs text-[#9C9A9A] py-4">No store outlets registered for this vendor yet.</p>
                ) : (
                  <div className="space-y-3 mt-2">
                    {selected.stores.map((s: any) => {
                      const addr = s.store_addresses || null;
                      return (
                        <div key={s.id} className="border border-[#E8E8E8] rounded-xl p-3.5 bg-[#FAFAFA]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-black">{s.store_name}</span>
                            <div className="flex gap-1.5">
                              <Badge
                                variant={s.business_type === 'grocery' ? 'grocery' : 'food'}
                                label={s.business_type || 'restaurant'}
                              />
                              <Badge
                                variant={s.status === 'SUSPENDED' ? 'busy' : (s.status?.toLowerCase() === 'online' ? 'online' : 'offline')}
                                label={s.status || 'OFFLINE'}
                                showDot
                              />
                            </div>
                          </div>
                          <DetailRow label="Store ID" value={s.id} mono />
                          <DetailRow label="Store Phone" value={s.phone || '—'} mono />
                          <DetailRow label="Store Email" value={s.email || '—'} />
                          <DetailRow
                            label="Service Radius"
                            value={addr?.service_radius_km ? `${addr.service_radius_km} km` : '6 km'}
                          />
                          <DetailRow
                            label="Physical Address"
                            value={
                              addr
                                ? [addr.address_line1, addr.locality, addr.city, addr.state, addr.postal_code]
                                    .filter(Boolean)
                                    .join(', ')
                                : 'Address not registered'
                            }
                          />

                          <div className="mt-3 pt-3 border-t border-[#E8E8E8] flex items-center justify-between">
                            {s.status === 'SUSPENDED' ? (
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Suspended: Orders blocked & offline
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnsuspendStore(s.id)}
                                  className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100 cursor-pointer"
                                >
                                  Unsuspend Store
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] text-[#9C9A9A]">Operational State: {s.status || 'OFFLINE'}</span>
                                <button
                                  type="button"
                                  onClick={() => handleSuspendStore(s.id)}
                                  className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100 cursor-pointer"
                                >
                                  Suspend Store
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DrawerSection>
            )}

            {/* TAB 3: KYC DOCUMENTS */}
            {tab === 'KYC Documents' && (
              <DrawerSection title={`UPLOADED DOCUMENTS (${selected.kyc_documents.length})`}>
                {selected.kyc_documents.length === 0 ? (
                  <p className="text-xs text-[#9C9A9A] py-4">No KYC documents uploaded for this vendor yet.</p>
                ) : (
                  <div className="space-y-3 mt-2">
                    {selected.kyc_documents.map((d: any) => {
                      const sizeKb = d.file_size_bytes ? Math.round(d.file_size_bytes / 1024) : null;
                      return (
                        <div key={d.id} className="border border-[#E8E8E8] rounded-xl p-3.5 bg-[#FAFAFA]">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#A35E47]" />
                              <span className="text-xs font-bold uppercase text-black tracking-wide">
                                {d.document_type}
                              </span>
                            </div>
                            <Badge
                              variant={
                                d.status === 'verified' ? 'active' : d.status === 'rejected' ? 'suspended' : 'pending'
                              }
                              label={d.status ? d.status.charAt(0).toUpperCase() + d.status.slice(1) : 'Pending'}
                            />
                          </div>
                          <DetailRow label="Document ID" value={d.id} mono />
                          <DetailRow label="File Name" value={d.file_name || '—'} />
                          <DetailRow label="File Size" value={sizeKb ? `${sizeKb} KB` : '—'} />
                          <DetailRow label="MIME Type" value={d.mime_type || '—'} />
                          <DetailRow
                            label="Uploaded At"
                            value={
                              d.uploaded_at
                                ? new Date(d.uploaded_at).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : '—'
                            }
                          />
                          <DetailRow label="Storage Path" value={d.storage_path || '—'} mono />
                          {d.rejection_reason && (
                            <DetailRow label="Rejection Note" value={d.rejection_reason} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DrawerSection>
            )}

            {/* TAB 4: TAX & BANKING */}
            {tab === 'Tax & Banking' && (
              <>
                <DrawerSection title="TAX IDENTIFIERS">
                  <DetailRow label="PAN Number" value={selected.pan} mono />
                  <DetailRow
                    label="PAN Verified"
                    value={
                      selected.tax_information?.pan_verified ? (
                        <span className="text-emerald-700 font-semibold">Verified</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Unverified</span>
                      )
                    }
                  />
                  <DetailRow label="GSTIN" value={selected.gst} mono />
                  <DetailRow
                    label="GSTIN Verified"
                    value={
                      selected.tax_information?.gstin_verified ? (
                        <span className="text-emerald-700 font-semibold">Verified</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Unverified</span>
                      )
                    }
                  />
                </DrawerSection>

                <DrawerSection title="BANK ACCOUNT DETAILS">
                  <DetailRow label="Bank Name" value={selected.bankName} />
                  <DetailRow label="Account Number" value={selected.bankAccount} mono />
                  <DetailRow label="IFSC Code" value={selected.bankIfsc} mono />
                  <DetailRow
                    label="Verification Status"
                    value={
                      selected.bankVerified ? (
                        <span className="text-emerald-700 font-semibold">Verified</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Pending Verification</span>
                      )
                    }
                  />
                  <DetailRow
                    label="Account Holder"
                    value={selected.bank_accounts?.account_holder_name || selected.owner_name}
                  />
                </DrawerSection>
              </>
            )}

            {/* Review Decision Bar in Drawer for Pending Applications */}
            {selected && (selected.onboarding_status === 'submitted' || selected.onboarding_status === 'under_review') && (
              <div className="mt-6 pt-4 border-t border-[#E8E8E8] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-black block">Review Decision</span>
                  <span className="text-[11px] text-[#777]">Status: {selected.onboarding_status}</span>
                </div>
                <div className="flex gap-2">
                  <Btn
                    small
                    variant="primary"
                    disabled={isSubmittingAction}
                    onClick={() => openApproveModal(selected)}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve Application
                  </Btn>
                  <Btn
                    small
                    danger
                    disabled={isSubmittingAction}
                    onClick={() => openRejectModal(selected)}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Reject Application
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Phase 2: Action Confirmation & Rejection Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-2xl max-w-lg w-full p-6 text-black relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8]">
              <div className="flex items-center gap-2.5">
                {actionModal.type === 'approve' ? (
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
                <h3 className="text-base font-bold text-black">
                  {actionModal.type === 'approve' ? 'Confirm Vendor Approval' : 'Reject Vendor Application'}
                </h3>
              </div>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => { setActionModal(null); setActionError(null); }}
                className="p-1 text-[#999] hover:text-black rounded-lg hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#777]">Business:</span>
                  <span className="font-bold text-black">{actionModal.vendor.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777]">Owner:</span>
                  <span className="font-medium text-black">{actionModal.vendor.owner_name} ({actionModal.vendor.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777]">Vendor Type:</span>
                  <span className="capitalize text-black font-semibold">{actionModal.vendor.vendor_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777]">KYC Files:</span>
                  <span className="font-mono text-black">{actionModal.vendor.kyc_documents.length} document(s) uploaded</span>
                </div>
              </div>

              {actionModal.type === 'approve' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                  <p className="font-bold mb-1">Lifecycle Rule Notice:</p>
                  <p>
                    Approving this application updates <code className="font-mono font-bold">vendors.onboarding_status = 'approved'</code> and marks uploaded KYC documents as verified. Per RoadRider lifecycle rules, store accounts will be set to <code className="font-mono font-bold">is_active = true</code> while maintaining <code className="font-mono font-bold">status = 'OFFLINE'</code> until the merchant decides to go online.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Rejection Reason (Recorded in KYC Audit Log) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Mismatch between PAN entity name and business registration certificate. Please upload clear copy of GSTIN."
                    className="w-full p-3 border border-[#D0D0D0] rounded-xl text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none font-sans"
                  />
                  <p className="text-[11px] text-[#777]">
                    This reason will be recorded in the KYC audit trail and displayed to the vendor.
                  </p>
                </div>
              )}

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Database Mutation Failed</p>
                    <p className="mt-0.5 leading-relaxed">{actionError}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E8E8]">
              <Btn
                small
                variant="ghost"
                disabled={isSubmittingAction}
                onClick={() => { setActionModal(null); setActionError(null); }}
              >
                Cancel
              </Btn>
              <Btn
                small
                variant={actionModal.type === 'approve' ? 'primary' : 'secondary'}
                danger={actionModal.type === 'reject'}
                disabled={isSubmittingAction}
                onClick={handleConfirmAction}
              >
                {isSubmittingAction ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Committing to Database...</span>
                  </div>
                ) : actionModal.type === 'approve' ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    <span>Confirm Approval</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <X className="w-3.5 h-3.5 mr-1" />
                    <span>Confirm Rejection</span>
                  </div>
                )}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
