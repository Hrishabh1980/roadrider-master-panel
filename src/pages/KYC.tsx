import React, { useState, useEffect, useCallback } from 'react';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, KPICard } from '../components/ui';
import { kycApi } from '../services/api';
import { isSupabaseConfigured, subscribeToTable, supabase } from '../services/supabase';
import { Check, X, CheckCircle, AlertTriangle, FileText, Download, Loader2, RefreshCw, ExternalLink, Eye } from 'lucide-react';
import { useBadges } from '../context/BadgeContext';

export default function KYC() {
  const { refreshBadges } = useBadges();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterDocType, setFilterDocType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Fetch KYC documents from database ──────────────────────────────
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await kycApi.getAll();
      setQueue(data || []);
    } catch (err: any) {
      console.warn('[KYC] Query failed:', err?.message || 'Database error');
      setQueue([]);
      setFetchError(err?.message || 'Failed to load KYC documents from database.');
      showToast(`Error fetching KYC queue: ${err?.message || 'Failed to load'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ─── Realtime subscription for live updates ─────────────────────────
  // Completely isolated from initial query so failure never causes a blank screen
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToTable('kyc_documents', (payload) => {
        // Safe logging without exposing sensitive document paths or PII
        console.log('[KYC Realtime] Document update received:', payload?.eventType);
        fetchQueue();
      });
    } catch (err: any) {
      console.warn('[KYC Realtime] Subscription warning:', err?.message || 'Realtime unavailable');
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (cleanupErr) {
          console.warn('[KYC Realtime] Teardown warning:', cleanupErr);
        }
      }
    };
  }, [fetchQueue]);

  // ─── Resolve document preview URL from storage_path ─────────────────
  const resolvePreviewUrl = useCallback(async (item: any) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewError(null);

    const storagePath = item.storage_path || item._raw?.storage_path;
    if (!storagePath) {
      setPreviewLoading(false);
      setPreviewError('No file reference recorded in database for this document.');
      return;
    }
    if (!isSupabaseConfigured) {
      setPreviewLoading(false);
      setPreviewError('Supabase storage connection not configured.');
      return;
    }

    try {
      // Strategy 1: Create short-lived signed URL from private kyc-documents bucket
      const signedUrl = await kycApi.getSignedDocumentUrl(storagePath);
      if (signedUrl) {
        setPreviewUrl(signedUrl);
        setPreviewLoading(false);
        return;
      }

      // Strategy 2: Download as blob URL
      const blobUrl = await kycApi.downloadDocumentAsBlob(storagePath);
      if (blobUrl) {
        setPreviewUrl(blobUrl);
        setPreviewLoading(false);
        return;
      }

      setPreviewError('The document file could not be accessed from the private kyc-documents storage bucket.');
    } catch (err: any) {
      console.warn('[KYC] Error resolving preview URL:', err);
      setPreviewError(err?.message || 'Error generating secure document preview.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ─── Verify / Approve a document (uses _dbId = actual uuid) ─────────
  const handleVerify = async (item: any) => {
    const dbId = item._dbId || item._raw?.id || item.id;
    setActionLoading(dbId);
    try {
      await kycApi.approve(dbId);
      setQueue(prev => prev.map(k => (k._dbId || k.id) === dbId ? { ...k, status: 'Verified' } : k));
      if (selected && (selected._dbId || selected.id) === dbId) {
        setSelected({ ...selected, status: 'Verified' });
      }
      showToast(`✅ Document ${item.id} verified and approved!`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Verification failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Reject a document ──────────────────────────────────────────────
  const handleReject = async (item: any) => {
    const dbId = item._dbId || item._raw?.id || item.id;
    setActionLoading(dbId);
    try {
      await kycApi.reject(dbId, 'Rejected by admin');
      setQueue(prev => prev.map(k => (k._dbId || k.id) === dbId ? { ...k, status: 'Rejected' } : k));
      if (selected && (selected._dbId || selected.id) === dbId) {
        setSelected({ ...selected, status: 'Rejected' });
      }
      showToast(`❌ Document ${item.id} rejected.`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Rejection failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    const pendingItems = queue.filter(k => k.status === 'Pending');
    let successCount = 0;
    for (const item of pendingItems) {
      const dbId = item._dbId || item._raw?.id || item.id;
      try {
        await kycApi.approve(dbId);
        setQueue(prev => prev.map(k => (k._dbId || k.id) === dbId ? { ...k, status: 'Verified' } : k));
        successCount++;
      } catch (err: any) {
        console.warn(`[KYC Bulk Approve] Failed for ${dbId}:`, err);
      }
    }
    if (successCount > 0) {
      showToast(`✅ ${successCount} document(s) verified.`);
      refreshBadges();
    } else {
      showToast('❌ Bulk verification could not be completed.');
    }
  };

  const handleBulkReject = async () => {
    const pendingItems = queue.filter(k => k.status === 'Pending');
    let successCount = 0;
    for (const item of pendingItems) {
      const dbId = item._dbId || item._raw?.id || item.id;
      try {
        await kycApi.reject(dbId, 'Bulk rejection by admin');
        setQueue(prev => prev.map(k => (k._dbId || k.id) === dbId ? { ...k, status: 'Rejected' } : k));
        successCount++;
      } catch (err: any) {
        console.warn(`[KYC Bulk Reject] Failed for ${dbId}:`, err);
      }
    }
    if (successCount > 0) {
      showToast(`❌ ${successCount} document(s) rejected.`);
      refreshBadges();
    } else {
      showToast('❌ Bulk rejection could not be completed.');
    }
  };

  // ─── Open drawer with preview ───────────────────────────────────────
  const openReview = (item: any) => {
    setSelected(item);
    setDrawerOpen(true);
    resolvePreviewUrl(item);
  };

  // ─── Format file size ──────────────────────────────────────────────
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // ─── Table columns ─────────────────────────────────────────────────
  const columns = [
    { key: 'id', label: 'KYC ID', width: '100px' },
    { key: 'entity', label: 'ENTITY' },
    { key: 'entityType', label: 'TYPE', width: '90px' },
    { key: 'type', label: 'DOCUMENT TYPE' },
    { key: 'status', label: 'STATUS', width: '110px' },
    { key: 'submitted', label: 'SUBMITTED', width: '100px' },
    { key: 'expiry', label: 'EXPIRY', width: '110px' },
    { key: 'actions', label: '', width: '100px' },
  ];

  const filteredQueue = queue.filter(item => {
    if (filterEntityType && item.entityType !== filterEntityType) return false;
    if (filterDocType && !String(item.type || '').toLowerCase().includes(filterDocType.toLowerCase())) return false;
    if (filterStatus && String(item.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        String(item.id || '').toLowerCase().includes(q) ||
        String(item.entity || '').toLowerCase().includes(q) ||
        String(item.type || '').toLowerCase().includes(q) ||
        String(item.file_name || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const rows = filteredQueue.map(k => ({
    ...k,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{k.id}</span>,
    entity: <span className="font-semibold text-black">{k.entity}</span>,
    entityType: <Badge variant={k.entityType === 'Vendor' ? 'food' : 'rides'} label={k.entityType} />,
    status: <Badge variant={k.status.toLowerCase()} label={k.status} showDot />,
    expiry: (
      <span className={`text-xs font-mono-data ${k.status === 'Expiring' ? 'text-[#A35E47] font-bold' : ''}`}>
        {k.expiry}
      </span>
    ),
    actions: (
      <div className="flex gap-2">
        <button
          onClick={e => { e.stopPropagation(); openReview(k); }}
          className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer"
        >
          Review
        </button>
      </div>
    ),
    _raw: k,
  }));

  // ─── Document type breakdown (computed from live data) ──────────────
  const DOC_TYPES = [
    { type: 'PAN Card', count: queue.filter(k => k.type === 'PAN Card' && k.status === 'Pending').length, status: 'Pending' },
    { type: 'GST Certificate', count: queue.filter(k => k.type === 'GST Certificate' && k.status === 'Pending').length, status: 'Pending' },
    { type: 'FSSAI License', count: queue.filter(k => k.type?.includes('FSSAI') && (k.status === 'Expiring' || k.status === 'Pending')).length, status: 'Expiring' },
    { type: 'Driving License', count: queue.filter(k => k.type === 'Driving License' && k.status === 'Pending').length, status: 'Pending' },
    { type: 'Vehicle Insurance', count: queue.filter(k => k.type?.includes('Insurance') && (k.status === 'Rejected' || k.status === 'Pending')).length, status: 'Rejected' },
    { type: 'Bank Account', count: queue.filter(k => k.type?.includes('Bank') && k.status === 'Pending').length, status: 'Clear' },
    { type: 'Vehicle RC', count: queue.filter(k => k.type?.includes('RC') && k.status === 'Pending').length, status: 'Clear' },
    { type: 'Aadhaar', count: queue.filter(k => k.type?.includes('Aadhaar') && k.status === 'Pending').length, status: 'Clear' },
  ];

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="KYC & Documents" subtitle="Identity verification queue for Lucknow vendors and delivery partners">
        <button
          onClick={fetchQueue}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl px-3 py-2 hover:bg-[#F5F5F5] transition-colors cursor-pointer mr-2"
          title="Refresh from database"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <Btn small onClick={handleBulkApprove}>Bulk Approve</Btn>
        <Btn small danger onClick={handleBulkReject}>Bulk Reject</Btn>
      </SectionHeader>

      {/* Source indicator */}
      {isSupabaseConfigured && (
        <div className="flex items-center gap-1.5 mb-4 text-[10px] text-[#9C9A9A]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Live data from Supabase · <span className="font-mono">{queue.length} records</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard label="PENDING REVIEW" value={String(queue.filter(k => k.status === 'Pending').length)} highlight />
        <KPICard label="EXPIRING SOON" value={String(queue.filter(k => k.status === 'Expiring').length)} highlight />
        <KPICard label="REJECTED" value={String(queue.filter(k => k.status === 'Rejected').length)} highlight />
        <KPICard label="VERIFIED TODAY" value={String(queue.filter(k => k.status === 'Verified').length)} />
        <KPICard label="TOTAL IN QUEUE" value={String(queue.length)} />
      </div>

      {/* Document type breakdown */}
      <div className="border border-[#E8E8E8] rounded-xl p-5 mb-5 bg-[#FAFAFA]">
        <p className="text-sm font-bold mb-4 text-black">DOCUMENT TYPE BREAKDOWN</p>
        <div className="grid grid-cols-4 gap-3">
          {DOC_TYPES.map(d => (
            <div key={d.type} className="flex items-center justify-between border border-[#E8E8E8] rounded-xl px-4 py-3 bg-white">
              <div>
                <p className="text-xs font-semibold text-[#464646]">{d.type}</p>
                <p className="text-[10px] text-[#9C9A9A]">
                  {d.count === 0 ? 'All cleared' : `${d.count} pending`}
                </p>
              </div>
              <Badge
                variant={d.count === 0 ? 'verified' : d.status.toLowerCase() as any}
                label={d.count === 0 ? '✓' : String(d.count)}
              />
            </div>
          ))}
        </div>
      </div>

      <FilterBar
        onSearch={setSearchQuery}
        filters={[
          {
            label: 'Entity Type',
            options: ['Vendor', 'Partner'],
            value: filterEntityType,
            onChange: setFilterEntityType,
          },
          {
            label: 'Document Type',
            options: ['PAN Card', 'GST Certificate', 'FSSAI License', 'Driving License', 'Vehicle Insurance', 'Vehicle RC', 'Bank Account', 'Aadhaar'],
            value: filterDocType,
            onChange: setFilterDocType,
          },
          {
            label: 'Status',
            options: ['Pending', 'Verified', 'Rejected', 'Expiring'],
            value: filterStatus,
            onChange: setFilterStatus,
          },
        ]}
      />

      {loading ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
          <p className="text-xs text-[#464646] font-bold">Loading KYC applications from Supabase...</p>
        </div>
      ) : fetchError ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-8 text-center my-4 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-xs font-bold mb-1">Failed to Load KYC Queue</p>
          <p className="text-[11px] text-red-600 mb-4">{fetchError}</p>
          <button
            onClick={fetchQueue}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Database Query
          </button>
        </div>
      ) : queue.length === 0 ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <FileText className="w-8 h-8 text-[#9C9A9A] mx-auto mb-2" />
          <p className="text-sm font-bold text-black mb-1">No KYC Documents Found</p>
          <p className="text-xs text-[#9C9A9A] mb-3">There are currently no KYC documents submitted in the database.</p>
          <button
            onClick={fetchQueue}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl px-3 py-1.5 hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
          </button>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <FileText className="w-8 h-8 text-[#9C9A9A] mx-auto mb-2" />
          <p className="text-sm font-bold text-black mb-1">No Matching Documents</p>
          <p className="text-xs text-[#9C9A9A] mb-3">No KYC documents match the active filter criteria.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterEntityType('');
              setFilterDocType('');
              setFilterStatus('');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A35E47] border border-[#A35E47]/30 rounded-xl px-3 py-1.5 hover:bg-[#A35E47]/10 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={row => openReview((row as any)._raw)}
        />
      )}

      {/* ─── Review Drawer ───────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => { setDrawerOpen(false); setPreviewUrl(null); }}
        title={selected?.type || ''}
        subtitle={selected?.entity}
        badge={selected ? <Badge variant={selected.status.toLowerCase()} label={selected.status} showDot /> : null}
      >
        {selected && (
          <>
            <DrawerSection title="DOCUMENT DETAILS">
              <DetailRow label="KYC ID" value={selected.id} mono />
              <DetailRow label="Entity" value={selected.entity} />
              <DetailRow label="Entity Type" value={selected.entityType} />
              <DetailRow label="Document" value={selected.type} />
              <DetailRow label="Submitted" value={selected.submitted} />
              <DetailRow label="Expiry" value={selected.expiry} />
              <DetailRow label="Status" value={<Badge variant={selected.status.toLowerCase()} label={selected.status} showDot />} />
              {selected.file_name && (
                <DetailRow label="File" value={selected.file_name} />
              )}
              {selected.file_size_bytes && (
                <DetailRow label="Size" value={formatFileSize(selected.file_size_bytes)} />
              )}
              {selected.mime_type && (
                <DetailRow label="Type" value={selected.mime_type} />
              )}
              {selected.rejection_reason && (
                <DetailRow label="Rejection Reason" value={<span className="text-red-500 text-xs">{selected.rejection_reason}</span>} />
              )}
              {selected.review_notes && (
                <DetailRow label="Review Notes" value={<span className="text-xs text-[#464646]">{selected.review_notes}</span>} />
              )}
              {selected.verified_at && (
                <DetailRow label="Verified At" value={new Date(selected.verified_at).toLocaleString('en-IN')} />
              )}
            </DrawerSection>

            {/* Document preview from Supabase Storage */}
            <DrawerSection title="DOCUMENT PREVIEW">
              <div className="border border-[#E8E8E8] rounded-xl bg-[#F5F5F5] overflow-hidden">
                {previewLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#A35E47]" />
                    <span className="ml-2 text-xs text-[#9C9A9A]">Loading document from storage...</span>
                  </div>
                ) : previewUrl ? (
                  <div className="flex flex-col">
                    {/* Render based on mime_type */}
                    {(selected.mime_type?.includes('pdf') || previewUrl.match(/\.pdf/i)) ? (
                      <div className="h-64 w-full">
                        <iframe
                          src={previewUrl}
                          className="w-full h-full border-0 rounded-t-xl"
                          title="Document Preview"
                        />
                      </div>
                    ) : (
                      <div className="relative group">
                        <img
                          src={previewUrl}
                          alt={`${selected.type} - ${selected.entity}`}
                          className="w-full h-auto max-h-72 object-contain bg-white rounded-t-xl p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'h-48 flex items-center justify-center text-center p-4';
                            fallbackDiv.innerHTML = `
                              <div>
                                <div class="text-3xl mb-1">📄</div>
                                <p class="text-xs font-bold text-black">${selected.type}</p>
                                <p class="text-[10px] text-[#9C9A9A]">Preview failed to load</p>
                              </div>
                            `;
                            (e.target as HTMLImageElement).parentElement!.appendChild(fallbackDiv);
                          }}
                        />
                        {/* Zoom overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-[#464646] shadow-lg flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Full Size
                          </a>
                        </div>
                      </div>
                    )}
                    {/* Info bar below preview */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-[#E8E8E8]">
                      <div>
                        <p className="text-xs font-bold text-black">{selected.file_name || selected.type}</p>
                        <p className="text-[10px] text-[#9C9A9A]">
                          {selected._raw?.uploaded_at
                            ? `Uploaded ${new Date(selected._raw.uploaded_at).toLocaleDateString('en-IN')}`
                            : 'From Supabase Storage'}
                          {selected.file_size_bytes ? ` · ${formatFileSize(selected.file_size_bytes)}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#A35E47] hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                        <a
                          href={previewUrl}
                          download={selected.file_name || 'document'}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#A35E47] hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                ) : previewError ? (
                  /* Inaccessible or missing file message */
                  <div className="h-48 flex flex-col items-center justify-center p-4 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-xs font-bold text-[#464646] mb-1">Document Preview Unavailable</p>
                    <p className="text-[11px] text-[#9C9A9A] max-w-xs mb-3">{previewError}</p>
                    {selected.storage_path && (
                      <button
                        onClick={() => resolvePreviewUrl(selected)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A35E47] text-white text-xs font-semibold rounded-lg hover:bg-[#8A4F3C] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry Loading Document
                      </button>
                    )}
                  </div>
                ) : (
                  /* No preview — placeholder */
                  <div className="h-48 flex items-center justify-center p-4">
                    <div className="text-center">
                      <div className="text-3xl mb-1">📄</div>
                      <p className="text-xs font-bold text-black">{selected.type}</p>
                      <p className="text-[10px] text-[#9C9A9A]">
                        {selected.storage_path
                          ? 'Document stored — click retry to generate signed URL'
                          : isSupabaseConfigured
                            ? 'No document file uploaded yet'
                            : 'Connect Supabase to view documents'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="VERIFICATION ACTIONS">
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => handleVerify(selected)}
                  disabled={!!actionLoading || selected.status === 'Verified'}
                  className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating database...</>
                  ) : selected.status === 'Verified' ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Already Verified</>
                  ) : (
                    '✓ Verify & Approve Document'
                  )}
                </button>
                <button
                  onClick={() => handleReject(selected)}
                  disabled={!!actionLoading || selected.status === 'Rejected'}
                  className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {selected.status === 'Rejected' ? (
                    <><X className="w-3.5 h-3.5" /> Already Rejected</>
                  ) : (
                    '✗ Reject Document'
                  )}
                </button>
                <button
                  onClick={() => showToast(`Resubmission link dispatched to ${selected.entity}`)}
                  className="w-full py-2.5 border border-[#E8E8E8] text-[#464646] hover:bg-[#F5F5F5] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Request Resubmission via SMS
                </button>
              </div>
            </DrawerSection>
          </>
        )}
      </Drawer>
    </div>
  );
}
