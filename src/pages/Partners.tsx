import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SectionHeader,
  DataTable,
  Badge,
  ServiceBadge,
  FilterBar,
  Drawer,
  DrawerSection,
  DetailRow,
  Btn,
  Tabs,
  AlertBanner,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { partnersApi, kycApi } from '../services/api';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { usePermissions } from '../context/PermissionsContext';
import { useBadges } from '../context/BadgeContext';
import {
  Check,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Copy,
  FileText,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  User,
  Calendar,
  ExternalLink,
  Download,
  AlertCircle,
  Clock,
  Car,
} from 'lucide-react';

const DRAWER_TABS = ['Overview', 'Vehicle & Licence', 'KYC & Review', 'Earnings & Standing'];

export default function Partners({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { isSuperAdmin, can } = usePermissions();
  const { refreshBadges } = useBadges();

  const [activeView, setActiveView] = useState<'all' | 'pending'>('all');
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterService, setFilterService] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Primary live partners query
  const { data: apiResponse, loading, error, refetch } = useApi(
    () =>
      partnersApi.getAll({
        vehicle: filterVehicle,
        service: filterService,
        status: activeView === 'pending' ? 'Pending Approval' : filterStatus,
        search: searchQuery,
      }),
    { data: [], total: 0 },
    [activeView, filterVehicle, filterService, filterStatus, searchQuery]
  );

  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Approval & Rejection Modal State
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'unsuspend';
    partner: any;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Secure Document Preview Modal State
  const [docPreviewModal, setDocPreviewModal] = useState<{
    url: string | null;
    title: string;
    fileName: string;
    isPdf: boolean;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);

  // Sync loaded partners
  useEffect(() => {
    if (apiResponse?.data) {
      setPartnersList(apiResponse.data);
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

  const handleRefresh = () => {
    refetch();
    refreshBadges();
    showToast('Syncing riders with Supabase...');
  };

  // Re-fetch individual partner details to keep drawer up to date
  const refreshSelectedPartner = async (partnerId: string) => {
    try {
      const refreshedList = await partnersApi.getAll();
      const updated = refreshedList.data.find((p: any) => p._dbId === partnerId);
      if (updated) {
        setSelected(updated);
      }
      refetch();
      refreshBadges();
    } catch (err) {
      console.warn('[Partners] Failed to refresh selected partner:', err);
    }
  };

  // Open Document Preview Modal safely using private storage signed URL
  const handleOpenDocPreview = async (doc: any) => {
    const storagePath = doc.storage_path;
    if (!storagePath) {
      showToast('No file storage reference recorded for this document.');
      return;
    }

    const isPdf =
      (doc.mime_type && doc.mime_type.includes('pdf')) ||
      (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf')) ||
      storagePath.toLowerCase().endsWith('.pdf');

    setDocPreviewModal({
      url: null,
      title: doc.document_type ? doc.document_type.replace(/_/g, ' ').toUpperCase() : 'DOCUMENT',
      fileName: doc.file_name || 'Uploaded File',
      isPdf,
      loading: true,
      error: null,
    });

    try {
      const signedUrl = await kycApi.getSignedDocumentUrl(storagePath, 'kyc-documents');
      if (signedUrl) {
        setDocPreviewModal(prev => (prev ? { ...prev, url: signedUrl, loading: false } : null));
      } else {
        setDocPreviewModal(prev =>
          prev ? { ...prev, loading: false, error: 'Could not generate secure document preview URL.' } : null
        );
      }
    } catch (err: any) {
      setDocPreviewModal(prev =>
        prev ? { ...prev, loading: false, error: err?.message || 'Failed to load document preview.' } : null
      );
    }
  };

  // Individual Document Verification
  const handleVerifyDocument = async (docId: string, partnerId: string) => {
    setVerifyingDocId(docId);
    try {
      await kycApi.approve(docId);
      showToast('Document marked as Verified!');
      await refreshSelectedPartner(partnerId);
    } catch (err: any) {
      showToast(`Error verifying document: ${err.message || 'Operation failed'}`);
    } finally {
      setVerifyingDocId(null);
    }
  };

  // Individual Document Rejection
  const handleRejectDocument = async (docId: string, partnerId: string) => {
    const reason = window.prompt(
      'Enter rejection reason for this document (e.g. Blurry photo, expired certificate, name mismatch):',
      'Document unclear or invalid. Please re-upload a clear copy.'
    );
    if (!reason || !reason.trim()) return;

    setVerifyingDocId(docId);
    try {
      await kycApi.reject(docId, reason.trim());
      showToast('Document marked as Rejected with recorded reason.');
      await refreshSelectedPartner(partnerId);
    } catch (err: any) {
      showToast(`Error rejecting document: ${err.message || 'Operation failed'}`);
    } finally {
      setVerifyingDocId(null);
    }
  };

  // Open Rider Approval Modal
  const openApproveModal = (partner: any) => {
    setActionError(null);
    setActionModal({ type: 'approve', partner });
  };

  // Open Rider Rejection Modal
  const openRejectModal = (partner: any) => {
    setActionError(null);
    setRejectionReason('');
    setActionModal({ type: 'reject', partner });
  };

  // Open Rider Suspension Modal
  const openSuspendModal = (partner: any) => {
    setActionError(null);
    setRejectionReason('');
    setActionModal({ type: 'suspend', partner });
  };

  // Execute Approval / Rejection / Suspension
  const handleConfirmAction = async () => {
    if (!actionModal) return;
    const { type, partner } = actionModal;

    if (type === 'reject' && !rejectionReason.trim()) {
      setActionError('A rejection reason is mandatory to reject a rider application.');
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    try {
      if (type === 'approve') {
        await partnersApi.approve(partner._dbId);
        showToast(`Rider "${partner.name}" approved! Account is now active.`);
      } else if (type === 'reject') {
        await partnersApi.reject(partner._dbId, rejectionReason.trim());
        showToast(`Rider "${partner.name}" rejected. Reason recorded in audit log.`);
      } else if (type === 'suspend') {
        await partnersApi.suspend(partner._dbId, rejectionReason.trim());
        showToast(`Rider "${partner.name}" has been suspended.`);
      } else if (type === 'unsuspend') {
        await partnersApi.unsuspend(partner._dbId);
        showToast(`Rider "${partner.name}" has been restored to Offline (eligible to go online).`);
      }

      setActionModal(null);
      setRejectionReason('');
      await refreshSelectedPartner(partner._dbId);
    } catch (err: any) {
      console.error(`[Partners] Error during rider ${type}:`, err);
      setActionError(err.message || `Database operation failed during ${type}.`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Quick Unsuspend button
  const handleQuickUnsuspend = async (partnerId: string) => {
    if (!window.confirm('Restore this rider to active standing? Status will be set to Offline.')) return;
    try {
      await partnersApi.unsuspend(partnerId);
      showToast('Rider restored to active standing.');
      await refreshSelectedPartner(partnerId);
    } catch (err: any) {
      showToast(`Error restoring rider: ${err.message}`);
    }
  };

  // Summary Metrics
  const totalRiders = partnersList.length;
  const pendingCount = partnersList.filter(p => p.isPendingApproval).length;
  const approvedCount = partnersList.filter(p => p.isApproved).length;
  const onlineCount = partnersList.filter(p => p.status === 'Online').length;
  const busyCount = partnersList.filter(p => p.status === 'Busy').length;
  const offlineCount = partnersList.filter(p => p.status === 'Offline' && p.isApproved).length;
  const suspendedCount = partnersList.filter(p => p.status === 'Suspended' || p.rawStatus === 'suspended').length;
  const rejectedCount = partnersList.filter(p => p.rawKycStatus === 'rejected').length;

  // Filtered rows for current view
  const displayedPartners = useMemo(() => {
    if (activeView === 'pending') {
      return partnersList.filter(p => p.isPendingApproval);
    }
    return partnersList;
  }, [activeView, partnersList]);

  // Table Columns
  const columns = [
    { key: 'id', label: 'RIDER ID', width: '130px' },
    { key: 'name', label: 'RIDER NAME & CONTACT' },
    { key: 'vehicle', label: 'VEHICLE' },
    { key: 'services', label: 'SERVICES' },
    { key: 'regDate', label: 'REGISTERED ON', width: '120px' },
    { key: 'kyc', label: 'APPLICATION / KYC', width: '150px' },
    { key: 'status', label: 'AVAILABILITY', width: '110px' },
    { key: 'actions', label: '', width: '120px' },
  ];

  const rows = displayedPartners.map(p => ({
    ...p,
    id: (
      <div className="flex items-center gap-1 group">
        <span className="text-xs font-mono font-bold text-[#555] bg-[#F5F5F5] px-1.5 py-0.5 rounded border border-[#E0E0E0] select-all" title={p._dbId}>
          {p.id}
        </span>
        <button
          onClick={e => {
            e.stopPropagation();
            copyToClipboard(p._dbId, 'Rider UUID');
          }}
          className="p-1 hover:bg-[#E8E8E8] rounded text-[#999] hover:text-black transition-colors"
          title="Copy full database UUID"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    ),
    name: (
      <div>
        <div className="font-semibold text-black text-xs flex items-center gap-1.5">
          {p.name}
          {p.rating && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1 rounded">{p.rating} ★</span>}
        </div>
        <div className="text-[11px] font-mono text-[#777] flex items-center gap-1 mt-0.5">
          <Phone className="w-2.5 h-2.5 text-[#999]" /> {p.phone}
        </div>
      </div>
    ),
    vehicle: (
      <div>
        <span className="text-xs font-bold text-black block">{p.vehicle}</span>
        <span className="text-[10px] font-mono text-[#888] uppercase">{p.vehicleNo || 'No Plate'}</span>
      </div>
    ),
    services: (
      <div className="flex gap-1 flex-wrap max-w-[170px]">
        {(p.services || ['Food', 'Courier']).map((s: string) => (
          <ServiceBadge key={s} service={s} />
        ))}
      </div>
    ),
    regDate: <span className="text-xs text-[#555] font-medium">{p.registrationDate}</span>,
    kyc: (
      <div>
        <Badge variant={p.kycBadgeVariant} label={p.kyc} />
        {p.isPendingApproval && (
          <span className="block text-[10px] text-amber-700 font-semibold mt-0.5">
            {p.canApprove ? 'Ready to Approve' : `${p.missingRequirements.length} req. pending`}
          </span>
        )}
      </div>
    ),
    status: <Badge variant={p.status?.toLowerCase() || 'offline'} label={p.status || 'Offline'} showDot />,
    actions: (
      <button
        onClick={e => {
          e.stopPropagation();
          setSelected(p);
          setTab(p.isPendingApproval ? 'KYC & Review' : 'Overview');
          setDrawerOpen(true);
        }}
        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
          p.isPendingApproval
            ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-sm'
            : 'bg-white text-[#A35E47] border-[#D0D0D0] hover:bg-[#F5F5F5]'
        }`}
      >
        {p.isPendingApproval ? 'Review Rider' : 'View Details'}
      </button>
    ),
    _raw: p,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      {/* Header */}
      <SectionHeader
        title="Riders & Delivery Partner Management"
        subtitle={`${totalRiders} registered fleet riders · ${pendingCount} awaiting approval · ${onlineCount} online now`}
      >
        <Btn small onClick={handleRefresh}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
      </SectionHeader>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E8E8] mb-5">
        <button
          onClick={() => setActiveView('all')}
          className={`pb-2.5 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
            activeView === 'all'
              ? 'border-black text-black'
              : 'border-transparent text-[#777] hover:text-black'
          }`}
        >
          All Registered Riders
          <span className="bg-[#F0F0F0] text-black px-1.5 py-0.2 rounded-full text-[10px] font-mono">
            {totalRiders}
          </span>
        </button>

        <button
          onClick={() => setActiveView('pending')}
          className={`pb-2.5 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
            activeView === 'pending'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-[#777] hover:text-amber-700'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Pending Approvals Queue
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-6 gap-4 mb-5">
        {[
          { label: 'TOTAL FLEET', value: String(totalRiders), desc: 'All registered accounts' },
          {
            label: 'PENDING APPROVAL',
            value: String(pendingCount),
            highlight: pendingCount > 0,
            desc: 'Awaiting review',
            onClick: () => setActiveView('pending'),
          },
          { label: 'APPROVED & ACTIVE', value: String(approvedCount), desc: 'Eligible to operate' },
          { label: 'ONLINE NOW', value: String(onlineCount), desc: 'Active in Lucknow' },
          { label: 'BUSY ON TRIP', value: String(busyCount), desc: 'Fulfilling orders' },
          {
            label: 'SUSPENDED / REJECTED',
            value: String(suspendedCount + rejectedCount),
            highlight: (suspendedCount + rejectedCount) > 0,
            desc: 'Blocked from service',
          },
        ].map(s => (
          <div
            key={s.label}
            onClick={s.onClick}
            className={`border rounded-xl p-3 bg-white transition-all ${
              (s as any).onClick ? 'cursor-pointer hover:border-amber-500 hover:shadow-sm' : ''
            } ${(s as any).highlight ? 'border-amber-300 bg-amber-50/40' : 'border-[#E8E8E8]'}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: (s as any).highlight ? '#B45309' : '#888' }}>
              {s.label}
            </p>
            <p className={`text-xl font-black font-mono ${(s as any).highlight ? 'text-amber-700' : 'text-black'}`}>
              {s.value}
            </p>
            <p className="text-[10px] text-[#999] mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={[
          {
            label: 'Vehicle',
            options: ['All', 'Motorcycle', 'Bicycle', 'Auto', 'Car'],
          },
          {
            label: 'Service',
            options: ['All', 'Food', 'Grocery', 'Rides', 'Courier'],
          },
          ...(activeView === 'all'
            ? [
                {
                  label: 'Status',
                  options: ['All', 'Pending Approval', 'Approved', 'Rejected', 'Suspended', 'Online', 'Offline'],
                },
              ]
            : []),
        ]}
      />

      {/* Main Data Table */}
      {loading ? (
        <div className="border border-[#E8E8E8] rounded-xl p-12 text-center bg-white my-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
          <p className="text-xs text-[#555] font-bold">Querying live fleet records from Supabase...</p>
        </div>
      ) : error ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-center my-4 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-xs font-bold">{error}</p>
          <div className="mt-3">
            <Btn small onClick={handleRefresh}>
              Retry Query
            </Btn>
          </div>
        </div>
      ) : displayedPartners.length === 0 ? (
        <div className="border border-[#E8E8E8] rounded-xl p-12 text-center bg-white my-4">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-black mb-1">
            {activeView === 'pending'
              ? 'No pending rider applications!'
              : 'No riders found matching the current criteria.'}
          </p>
          <p className="text-xs text-[#888]">
            {activeView === 'pending'
              ? 'All registered rider applications have been reviewed and processed.'
              : 'Try clearing search filters or refreshing from Supabase.'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={row => {
            setSelected((row as any)._raw);
            setTab((row as any)._raw.isPendingApproval ? 'KYC & Review' : 'Overview');
            setDrawerOpen(true);
          }}
        />
      )}

      {/* Detailed Rider Profile & Approval Review Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.name || 'Rider Profile'}
        subtitle={`${selected?.id} · ${selected?.vehicle || 'Delivery Partner'} · ${selected?.city || 'Lucknow'}`}
        badge={
          selected ? (
            <div className="flex gap-1.5">
              <Badge variant={selected.kycBadgeVariant} label={selected.kyc} />
              <Badge variant={selected.status?.toLowerCase() || 'offline'} label={selected.status || 'Offline'} showDot />
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
                <DrawerSection title="RIDER IDENTITY & ACCOUNT DETAILS">
                  <div className="flex items-center justify-between py-1 border-b border-[#F5F5F5]">
                    <span className="text-xs text-[#777] font-semibold">Rider UUID</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-black select-all">{selected._dbId}</span>
                      <button
                        onClick={() => copyToClipboard(selected._dbId, 'Rider UUID')}
                        className="p-1 hover:bg-[#E8E8E8] rounded text-[#888] hover:text-black transition-colors"
                        title="Copy full UUID"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <DetailRow label="Full Name" value={selected.name} />
                  <DetailRow label="Mobile Number" value={selected.phone} mono />
                  <DetailRow label="Email Address" value={selected.email || '—'} />
                  <DetailRow
                    label="Date of Birth"
                    value={
                      selected.dateOfBirth
                        ? `${new Date(selected.dateOfBirth).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })} (${Math.floor((Date.now() - new Date(selected.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))} yrs)`
                        : '—'
                    }
                  />
                  <DetailRow label="Gender" value={selected.gender ? String(selected.gender).toUpperCase() : '—'} />
                  <DetailRow label="Registration Date" value={selected.registrationDate} />
                  <DetailRow label="Last Operational Ping" value={selected.lastSeen ? new Date(selected.lastSeen).toLocaleString('en-IN') : 'Never'} />
                  <DetailRow
                    label="Enabled Services"
                    value={
                      <div className="flex gap-1 flex-wrap">
                        {(selected.services || ['Food', 'Courier']).map((s: string) => (
                          <ServiceBadge key={s} service={s} />
                        ))}
                      </div>
                    }
                  />
                </DrawerSection>

                <DrawerSection title="OPERATIONAL STANDING">
                  <DetailRow
                    label="Account Approval"
                    value={<Badge variant={selected.kycBadgeVariant} label={selected.kyc} />}
                  />
                  <DetailRow
                    label="Active / Online Permission"
                    value={
                      selected.isActive ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Authorized to Operate
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Inactive / Approval Required
                        </span>
                      )
                    }
                  />
                  {selected.rejectionReason && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                      <span className="font-bold block mb-0.5">Recorded Rejection Reason:</span>
                      {selected.rejectionReason}
                    </div>
                  )}
                </DrawerSection>
              </>
            )}

            {/* TAB 2: VEHICLE & LICENCE */}
            {tab === 'Vehicle & Licence' && (
              <DrawerSection title="REGISTERED VEHICLE SPECIFICATIONS">
                <DetailRow label="Primary Vehicle Type" value={selected.vehicle || 'Motorcycle'} />
                <DetailRow label="Registration Plate No." value={selected.vehicleNo || '—'} mono />
                <DetailRow label="Make & Model" value={selected.vehicleMakeModel || '—'} />
                <DetailRow label="Model Year" value={selected.vehicleYear ? String(selected.vehicleYear) : '—'} />
                <DetailRow
                  label="Fleet Classification"
                  value={
                    selected.vehicle.toLowerCase() === 'bicycle'
                      ? 'Non-Motorized (Delivery Only)'
                      : 'Motor Transport (Licensed)'
                  }
                />
              </DrawerSection>
            )}

            {/* TAB 3: KYC & DOCUMENT REVIEW */}
            {tab === 'KYC & Review' && (
              <>
                {/* Visual Onboarding Requirements Checklist */}
                <DrawerSection title="ONBOARDING APPROVAL CHECKLIST">
                  <div className="p-3.5 rounded-xl border mb-3 bg-[#FAFAFA] space-y-2.5">
                    {/* Personal Info Checks */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#555] font-medium flex items-center gap-2">
                        {selected.name && selected.name.length >= 2 ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        Full Legal Name ({selected.name})
                      </span>
                      <span className="font-bold text-[11px] text-emerald-700">Verified</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#555] font-medium flex items-center gap-2">
                        {selected.dateOfBirth ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        Date of Birth & Age Verification (&gt;=18 yrs)
                      </span>
                      <span className={`font-bold text-[11px] ${selected.dateOfBirth ? 'text-emerald-700' : 'text-red-600'}`}>
                        {selected.dateOfBirth ? 'Verified Adult' : 'Missing'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#555] font-medium flex items-center gap-2">
                        {selected.gender ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        Gender Declaration
                      </span>
                      <span className={`font-bold text-[11px] ${selected.gender ? 'text-emerald-700' : 'text-red-600'}`}>
                        {selected.gender ? 'Recorded' : 'Missing'}
                      </span>
                    </div>

                    <div className="border-t border-[#E8E8E8] pt-2" />

                    {/* Required Documents Checklist */}
                    {selected.requiredDocs.map((docReq: any) => (
                      <div key={docReq.type} className="flex items-center justify-between text-xs">
                        <span className="text-[#555] font-medium flex items-center gap-2">
                          {docReq.status === 'verified' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                          ) : docReq.status === 'rejected' ? (
                            <X className="w-4 h-4 text-red-600" />
                          ) : docReq.status === 'pending' ? (
                            <Clock className="w-4 h-4 text-amber-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          {docReq.title}
                        </span>
                        <span
                          className={`font-bold text-[11px] uppercase ${
                            docReq.status === 'verified'
                              ? 'text-emerald-700'
                              : docReq.status === 'rejected'
                              ? 'text-red-600'
                              : docReq.status === 'pending'
                              ? 'text-amber-600'
                              : 'text-red-500'
                          }`}
                        >
                          {docReq.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Readiness Status Banner */}
                  {selected.canApprove ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Ready for Account Approval</p>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          All mandatory personal information and required KYC documents have been verified. You can now approve this rider account.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Approval Blocked ({selected.missingRequirements.length} pending items)</p>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-amber-800">
                          {selected.missingRequirements.map((req: string, idx: number) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </DrawerSection>

                {/* Uploaded Documents List with Preview and Verification Actions */}
                <DrawerSection title={`UPLOADED KYC DOCUMENTS (${selected.documents.length})`}>
                  {selected.documents.length === 0 ? (
                    <p className="text-xs text-[#888] py-4 text-center">
                      No KYC documents have been uploaded by this rider yet.
                    </p>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {selected.documents.map((doc: any) => {
                        const isDocVerified = (doc.status || '').toLowerCase() === 'verified';
                        const isDocRejected = (doc.status || '').toLowerCase() === 'rejected';
                        const sizeKb = doc.file_size_bytes ? Math.round(doc.file_size_bytes / 1024) : null;

                        return (
                          <div key={doc.id} className="border border-[#E8E8E8] rounded-xl p-3.5 bg-white shadow-xs">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-[#A35E47]" />
                                <span className="text-xs font-bold uppercase text-black tracking-wide">
                                  {doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'Document'}
                                </span>
                              </div>
                              <Badge
                                variant={isDocVerified ? 'active' : isDocRejected ? 'suspended' : 'pending'}
                                label={isDocVerified ? 'Verified' : isDocRejected ? 'Rejected' : 'Pending Verification'}
                              />
                            </div>

                            <DetailRow label="File Name" value={doc.file_name || 'Uploaded File'} />
                            <DetailRow label="Storage Path" value={doc.storage_path || '—'} mono />
                            {sizeKb && <DetailRow label="File Size" value={`${sizeKb} KB`} />}
                            {doc.rejection_reason && (
                              <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-800">
                                <span className="font-bold">Rejection Note: </span>
                                {doc.rejection_reason}
                              </div>
                            )}

                            {/* Document Actions */}
                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#F0F0F0]">
                              <button
                                type="button"
                                onClick={() => handleOpenDocPreview(doc)}
                                className="text-xs font-bold text-black flex items-center gap-1 hover:text-[#A35E47] transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#A35E47]" /> View Document File
                              </button>

                              {/* Only Super Admin can verify or reject */}
                              {(isSuperAdmin || can('partners', 'approve')) && (
                                <div className="flex items-center gap-2">
                                  {!isDocVerified && (
                                    <button
                                      type="button"
                                      disabled={verifyingDocId === doc.id}
                                      onClick={() => handleVerifyDocument(doc.id, selected._dbId)}
                                      className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      {verifyingDocId === doc.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                      Verify
                                    </button>
                                  )}

                                  {!isDocRejected && (
                                    <button
                                      type="button"
                                      disabled={verifyingDocId === doc.id}
                                      onClick={() => handleRejectDocument(doc.id, selected._dbId)}
                                      className="text-xs font-bold text-red-700 bg-red-50 border border-red-300 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" /> Reject
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </DrawerSection>
              </>
            )}

            {/* TAB 4: EARNINGS & STANDING */}
            {tab === 'Earnings & Standing' && (
              <DrawerSection title="OPERATIONAL TRACK RECORD">
                <DetailRow label="Recorded Earnings" value={selected.earnings || '₹0'} />
                <DetailRow label="Fleet Rating" value={`${selected.rating || '5.0'} ★`} />
                <DetailRow label="Total Completed Jobs" value={String(selected.totalJobsDone || 0)} mono />
                <DetailRow label="Acceptance Rate" value={selected.acceptance || '100%'} />
                <DetailRow label="Completion Rate" value={selected.completion || '100%'} />
                <DetailRow label="Cancellation Rate" value={selected.cancellation || '0%'} />
              </DrawerSection>
            )}

            {/* Sticky Drawer Footer for Administrative Action */}
            <div className="pt-4 border-t border-[#E8E8E8] mt-6">
              {selected.isPendingApproval ? (
                <div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!selected.canApprove || isSubmittingAction}
                      onClick={() => openApproveModal(selected)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                        selected.canApprove
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Rider Application
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingAction}
                      onClick={() => openRejectModal(selected)}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>

                  {!selected.canApprove && (
                    <p className="text-[11px] text-amber-700 font-semibold mt-2 text-center">
                      ⚠ Approve button will unlock once all required KYC documents are verified.
                    </p>
                  )}
                </div>
              ) : selected.isApproved ? (
                <div className="space-y-2">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Rider Approved & Account Active
                    </span>
                    <button
                      type="button"
                      onClick={() => openSuspendModal(selected)}
                      className="text-xs font-bold text-red-700 bg-white border border-red-300 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Suspend Rider
                    </button>
                  </div>
                </div>
              ) : selected.status === 'Suspended' || selected.rawStatus === 'suspended' ? (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Rider Account Suspended
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickUnsuspend(selected._dbId)}
                    className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-3 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    Restore Online Eligibility
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </Drawer>

      {/* Confirmation & Decision Modal (Approve / Reject / Suspend) */}
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
                  {actionModal.type === 'approve'
                    ? 'Confirm Rider Approval'
                    : actionModal.type === 'reject'
                    ? 'Reject Rider Application'
                    : 'Suspend Rider Account'}
                </h3>
              </div>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => {
                  setActionModal(null);
                  setActionError(null);
                }}
                className="p-1 text-[#999] hover:text-black rounded-lg hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#777]">Rider Name:</span>
                  <span className="font-bold text-black">{actionModal.partner.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777]">Mobile / Contact:</span>
                  <span className="font-mono text-black">{actionModal.partner.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777]">Vehicle Category:</span>
                  <span className="font-semibold text-black">{actionModal.partner.vehicle} ({actionModal.partner.vehicleNo})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777]">KYC Verification:</span>
                  <span className="font-bold text-emerald-700">All Required Documents Verified</span>
                </div>
              </div>

              {actionModal.type === 'approve' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                  <p className="font-bold mb-1">Authoritative Lifecycle Enforcement:</p>
                  <p>
                    Approving this rider sets <code className="font-mono font-bold">partners.kyc_status = &apos;verified&apos;</code> and <code className="font-mono font-bold">partners.is_active = true</code>. The rider will be granted immediate access to log in and go online in the RoadRider Driver App to receive deliveries and rides.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Rejection / Suspension Reason (Recorded in KYC Audit Log) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="e.g. Expired driving licence, unreadable ID copy, or policy violation."
                    className="w-full p-3 border border-[#D0D0D0] rounded-xl text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none font-sans"
                  />
                </div>
              )}

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                  {actionError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8]">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => {
                  setActionModal(null);
                  setActionError(null);
                }}
                className="px-4 py-2 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleConfirmAction}
                className={`px-5 py-2 text-xs font-bold rounded-xl text-white transition-all flex items-center gap-1.5 cursor-pointer ${
                  actionModal.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                    : 'bg-red-600 hover:bg-red-700 shadow-sm'
                }`}
              >
                {isSubmittingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {actionModal.type === 'approve'
                  ? 'Confirm & Approve Rider'
                  : actionModal.type === 'reject'
                  ? 'Confirm Rejection'
                  : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure KYC Document Viewer Modal */}
      {docPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E8E8]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#A35E47]" />
                <h3 className="text-sm font-bold text-black">{docPreviewModal.title}</h3>
                <span className="text-xs text-[#888]">({docPreviewModal.fileName})</span>
              </div>
              <button
                onClick={() => setDocPreviewModal(null)}
                className="p-1 rounded-lg hover:bg-[#F5F5F5] text-[#888] hover:text-black transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-[#F8F8F8] flex items-center justify-center min-h-[400px]">
              {docPreviewModal.loading ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#A35E47] mx-auto mb-2" />
                  <p className="text-xs text-[#666] font-semibold">Generating secure private document URL...</p>
                </div>
              ) : docPreviewModal.error ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs text-center max-w-md">
                  <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-1.5" />
                  <p className="font-bold">Cannot Preview Document</p>
                  <p className="text-[11px] text-red-700 mt-1">{docPreviewModal.error}</p>
                </div>
              ) : docPreviewModal.isPdf && docPreviewModal.url ? (
                <iframe
                  src={docPreviewModal.url}
                  className="w-full h-[550px] rounded-xl border border-[#D0D0D0] bg-white"
                  title="PDF Document Preview"
                />
              ) : docPreviewModal.url ? (
                <img
                  src={docPreviewModal.url}
                  alt={docPreviewModal.title}
                  className="max-h-[550px] max-w-full rounded-xl object-contain shadow-md border border-[#E8E8E8]"
                />
              ) : null}
            </div>

            <div className="p-3 border-t border-[#E8E8E8] flex justify-between items-center bg-white">
              <span className="text-[11px] text-[#888]">
                Secure signed URL session • Kept strictly private to administrators
              </span>
              {docPreviewModal.url && (
                <a
                  href={docPreviewModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#A35E47] hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
