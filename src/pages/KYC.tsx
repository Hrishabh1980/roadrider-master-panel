import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, KPICard } from '../components/ui';
import { kycApi } from '../services/api';
import { isSupabaseConfigured, subscribeToTable, supabase } from '../services/supabase';
import {
  Check,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Download,
  Loader2,
  RefreshCw,
  ExternalLink,
  Eye,
  Users,
  User,
  Store,
  Bike,
  Copy,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  Phone,
  Mail,
  CheckCheck,
  HelpCircle,
} from 'lucide-react';
import { useBadges } from '../context/BadgeContext';

export interface GroupedKYCEntity {
  entityId: string;
  entityName: string;
  ownerName?: string;
  entityType: 'Vendor' | 'Rider' | 'Customer';
  phone: string;
  email: string;
  documents: any[];
  totalDocs: number;
  verifiedDocs: number;
  pendingDocs: number;
  rejectedDocs: number;
  expiringDocs: number;
  overallStatus: 'Pending Review' | 'Fully Verified' | 'Action Required' | 'Expiring';
  lastSubmitted: string;
}

export default function KYC() {
  const { refreshBadges } = useBadges();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // View mode: 'grouped' (Grouped by Person / Entity - default) or 'individual' (flat queue)
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');

  // Grouped Entity Drawer state
  const [selectedEntity, setSelectedEntity] = useState<GroupedKYCEntity | null>(null);
  const [activeEntityDocIndex, setActiveEntityDocIndex] = useState<number>(0);
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);

  // Individual Document Drawer state (for flat mode)
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [docDrawerOpen, setDocDrawerOpen] = useState(false);

  // Feedback, toasts, actions
  const [toast, setToast] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterDocType, setFilterDocType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, label: string = 'Unique ID') => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(text);
      showToast(`Copied ${label}: ${text}`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast(`UID: ${text}`);
    }
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
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToTable('kyc_documents', (payload) => {
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

  // ─── Group Queue by Person / Entity UID ─────────────────────────────
  const groupedEntities = useMemo<GroupedKYCEntity[]>(() => {
    const map = new Map<string, GroupedKYCEntity>();

    for (const item of queue) {
      // Prioritize explicit entityId, fallback to vendor/partner/customer ID or entity name
      const key = item.entityId || item.vendorId || item.partnerId || item.customerId || item.entity || item.id;
      if (!map.has(key)) {
        const resolvedName = item.entityName || item.entity || (item.entityType === 'Vendor' ? 'Lucknow Gourmet Store' : item.entityType === 'Rider' ? 'Suresh Pal' : 'Customer Account');
        map.set(key, {
          entityId: item.entityId || key,
          entityName: resolvedName,
          ownerName: item.ownerName || '',
          entityType: item.entityType || 'Vendor',
          phone: item.phone || '+91 98390 12841',
          email: item.email || '',
          documents: [],
          totalDocs: 0,
          verifiedDocs: 0,
          pendingDocs: 0,
          rejectedDocs: 0,
          expiringDocs: 0,
          overallStatus: 'Pending Review',
          lastSubmitted: item.submitted || 'Recently',
        });
      }

      const entity = map.get(key)!;
      entity.documents.push(item);
    }

    return Array.from(map.values()).map(group => {
      const totalDocs = group.documents.length;
      const verifiedDocs = group.documents.filter(d => d.status === 'Verified').length;
      const pendingDocs = group.documents.filter(d => d.status === 'Pending').length;
      const rejectedDocs = group.documents.filter(d => d.status === 'Rejected').length;
      const expiringDocs = group.documents.filter(d => d.status === 'Expiring').length;

      let overallStatus: 'Pending Review' | 'Fully Verified' | 'Action Required' | 'Expiring' = 'Pending Review';
      if (rejectedDocs > 0) {
        overallStatus = 'Action Required';
      } else if (pendingDocs > 0) {
        overallStatus = 'Pending Review';
      } else if (expiringDocs > 0) {
        overallStatus = 'Expiring';
      } else {
        overallStatus = 'Fully Verified';
      }

      return {
        ...group,
        totalDocs,
        verifiedDocs,
        pendingDocs,
        rejectedDocs,
        expiringDocs,
        overallStatus,
      };
    });
  }, [queue]);

  // Keep open drawer synced when queue refreshes
  useEffect(() => {
    if (selectedEntity && entityDrawerOpen) {
      const refreshed = groupedEntities.find(g => g.entityId === selectedEntity.entityId);
      if (refreshed) {
        setSelectedEntity(refreshed);
      }
    }
  }, [groupedEntities, entityDrawerOpen, selectedEntity]);

  // ─── Resolve document preview URL from storage_path ─────────────────
  const resolvePreviewUrl = useCallback(async (item: any) => {
    if (!item) {
      setPreviewUrl(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewError(null);

    const storagePath = item.storage_path || item._raw?.storage_path;
    if (!storagePath) {
      setPreviewLoading(false);
      setPreviewError('No physical file attachment recorded in database for this document.');
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

      setPreviewError('The document file could not be accessed from private kyc-documents storage bucket.');
    } catch (err: any) {
      console.warn('[KYC] Error resolving preview URL:', err);
      setPreviewError(err?.message || 'Error generating secure document preview.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ─── Single Document Approve ────────────────────────────────────────
  const handleVerifySingle = async (item: any) => {
    const dbId = item._dbId || item._raw?.id || item.id;
    setActionLoading(dbId);
    try {
      await kycApi.approve(dbId);
      setQueue(prev => prev.map(k => (k._dbId || k.id) === dbId ? { ...k, status: 'Verified', verified_at: new Date().toISOString() } : k));
      if (selectedDoc && (selectedDoc._dbId || selectedDoc.id) === dbId) {
        setSelectedDoc({ ...selectedDoc, status: 'Verified', verified_at: new Date().toISOString() });
      }
      showToast(`✅ Document "${item.type || item.id}" verified and approved.`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Verification failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Single Document Reject ─────────────────────────────────────────
  const handleRejectSingle = async (item: any, reason: string = 'Rejected by admin during compliance review') => {
    const dbId = item._dbId || item._raw?.id || item.id;
    setActionLoading(dbId);
    try {
      await kycApi.reject(dbId, reason);
      setQueue(prev => prev.map(k => (k._dbId || k.id) === dbId ? { ...k, status: 'Rejected', rejection_reason: reason } : k));
      if (selectedDoc && (selectedDoc._dbId || selectedDoc.id) === dbId) {
        setSelectedDoc({ ...selectedDoc, status: 'Rejected', rejection_reason: reason });
      }
      showToast(`❌ Document "${item.type || item.id}" rejected.`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Rejection failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── "VERIFY TOGETHER" for an entire Person / Entity ────────────────
  const handleVerifyAllForEntity = async (entity: GroupedKYCEntity) => {
    const pendingDocs = entity.documents.filter(d => d.status === 'Pending' || d.status === 'Expiring');
    if (pendingDocs.length === 0) {
      showToast(`All documents for ${entity.entityName} are already verified.`);
      return;
    }

    const dbIds = pendingDocs.map(d => d._dbId || d.id);
    setActionLoading(entity.entityId);
    try {
      await kycApi.approveAll(dbIds);
      const verifiedAt = new Date().toISOString();
      setQueue(prev => prev.map(k => {
        const matchId = k._dbId || k.id;
        return dbIds.includes(matchId) ? { ...k, status: 'Verified', verified_at: verifiedAt } : k;
      }));
      showToast(`✅ All ${pendingDocs.length} pending KYC documents for ${entity.entityName} verified together!`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Group verification failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Reject All Documents for a Person / Entity ─────────────────────
  const handleRejectAllForEntity = async (entity: GroupedKYCEntity, reason: string = 'Incomplete or unverified KYC documentation') => {
    const dbIds = entity.documents.map(d => d._dbId || d.id);
    setActionLoading(entity.entityId);
    try {
      await kycApi.rejectAll(dbIds, reason);
      setQueue(prev => prev.map(k => {
        const matchId = k._dbId || k.id;
        return dbIds.includes(matchId) ? { ...k, status: 'Rejected', rejection_reason: reason } : k;
      }));
      showToast(`❌ All ${entity.documents.length} documents for ${entity.entityName} rejected.`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Rejection failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Bulk Approve across all Pending items ──────────────────────────
  // BUG-019 FIX: Requires explicit confirmation before bulk action
  const handleBulkApprove = async () => {
    const pendingItems = queue.filter(k => k.status === 'Pending');
    if (pendingItems.length === 0) {
      showToast('No pending documents to approve.');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ Bulk Approve Confirmation\n\nYou are about to approve ${pendingItems.length} pending KYC document(s).\n\nThis action cannot be undone. Are you sure?`
    );
    if (!confirmed) return;
    const dbIds = pendingItems.map(d => d._dbId || d.id);
    setActionLoading('bulk');
    try {
      await kycApi.approveAll(dbIds);
      const verifiedAt = new Date().toISOString();
      setQueue(prev => prev.map(k => dbIds.includes(k._dbId || k.id) ? { ...k, status: 'Verified', verified_at: verifiedAt } : k));
      showToast(`✅ All ${dbIds.length} pending documents verified.`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Bulk approval failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Bulk Reject across all Pending items ───────────────────────────
  // BUG-019 FIX: Requires explicit confirmation before bulk action
  const handleBulkReject = async () => {
    const pendingItems = queue.filter(k => k.status === 'Pending');
    if (pendingItems.length === 0) {
      showToast('No pending documents to reject.');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ Bulk Reject Confirmation\n\nYou are about to reject ${pendingItems.length} pending KYC document(s).\n\nThis action cannot be undone. Are you sure?`
    );
    if (!confirmed) return;
    const dbIds = pendingItems.map(d => d._dbId || d.id);
    setActionLoading('bulk');
    try {
      await kycApi.rejectAll(dbIds, 'Bulk compliance rejection by super admin');
      setQueue(prev => prev.map(k => dbIds.includes(k._dbId || k.id) ? { ...k, status: 'Rejected', rejection_reason: 'Bulk rejection by admin' } : k));
      showToast(`❌ ${dbIds.length} documents rejected.`);
      refreshBadges();
    } catch (err: any) {
      showToast(`❌ Bulk rejection failed: ${err.message || 'Operation failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Open Grouped Person Drawer ─────────────────────────────────────
  const openEntityDrawer = (entity: GroupedKYCEntity, initialDocIndex: number = 0) => {
    setSelectedEntity(entity);
    setActiveEntityDocIndex(initialDocIndex);
    setEntityDrawerOpen(true);
    const targetDoc = entity.documents[initialDocIndex] || entity.documents[0];
    if (targetDoc) {
      resolvePreviewUrl(targetDoc);
    }
  };

  // ─── Open Individual Document Drawer ────────────────────────────────
  const openDocDrawer = (item: any) => {
    setSelectedDoc(item);
    setDocDrawerOpen(true);
    resolvePreviewUrl(item);
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // ─── Filtered Grouped Entities ──────────────────────────────────────
  const filteredGrouped = useMemo(() => {
    return groupedEntities.filter(entity => {
      if (filterEntityType && entity.entityType.toLowerCase() !== filterEntityType.toLowerCase()) {
        return false;
      }
      if (filterStatus) {
        const s = filterStatus.toLowerCase();
        const entityOverall = entity.overallStatus.toLowerCase();
        if (s === 'pending' && !entityOverall.includes('pending')) return false;
        if (s === 'verified' && !entityOverall.includes('verified')) return false;
        if ((s === 'rejected' || s === 'action required') && !entityOverall.includes('action') && !entityOverall.includes('reject')) return false;
        if (s === 'expiring' && !entityOverall.includes('expiring')) return false;
      }
      if (filterDocType) {
        const hasDocType = entity.documents.some(d =>
          String(d.type || d.documentType || '').toLowerCase().includes(filterDocType.toLowerCase())
        );
        if (!hasDocType) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          entity.entityName.toLowerCase().includes(q) ||
          entity.entityId.toLowerCase().includes(q) ||
          (entity.ownerName && entity.ownerName.toLowerCase().includes(q)) ||
          (entity.phone && entity.phone.toLowerCase().includes(q)) ||
          (entity.email && entity.email.toLowerCase().includes(q)) ||
          entity.documents.some(d =>
            String(d.type || '').toLowerCase().includes(q) ||
            String(d.id || '').toLowerCase().includes(q) ||
            String(d.file_name || '').toLowerCase().includes(q)
          );
        if (!matches) return false;
      }
      return true;
    });
  }, [groupedEntities, filterEntityType, filterStatus, filterDocType, searchQuery]);

  // ─── Filtered Individual Documents (Flat Queue) ─────────────────────
  const filteredIndividual = useMemo(() => {
    return queue.filter(item => {
      if (filterEntityType && item.entityType !== filterEntityType) return false;
      if (filterDocType && !String(item.type || '').toLowerCase().includes(filterDocType.toLowerCase())) return false;
      if (filterStatus && String(item.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(item.id || '').toLowerCase().includes(q) ||
          String(item.entity || '').toLowerCase().includes(q) ||
          String(item.entityName || '').toLowerCase().includes(q) ||
          String(item.entityId || '').toLowerCase().includes(q) ||
          String(item.phone || '').toLowerCase().includes(q) ||
          String(item.type || '').toLowerCase().includes(q) ||
          String(item.file_name || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [queue, filterEntityType, filterDocType, filterStatus, searchQuery]);

  // ─── Helper: Entity Type Badge Component ────────────────────────────
  const renderEntityTypeBadge = (type: 'Vendor' | 'Rider' | 'Customer') => {
    if (type === 'Vendor') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Store className="w-3 h-3 text-amber-700 shrink-0" />
          Vendor
        </span>
      );
    }
    if (type === 'Rider') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <Bike className="w-3 h-3 text-blue-700 shrink-0" />
          Rider
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
        <User className="w-3 h-3 text-purple-700 shrink-0" />
        Customer
      </span>
    );
  };

  // ─── Helper: Status Badge Component ─────────────────────────────────
  const renderOverallStatusBadge = (status: 'Pending Review' | 'Fully Verified' | 'Action Required' | 'Expiring') => {
    if (status === 'Fully Verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-black text-white">
          <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
          Fully Verified
        </span>
      );
    }
    if (status === 'Action Required') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
          Action Required
        </span>
      );
    }
    if (status === 'Expiring') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-[#FFF8F0] text-[#A35E47] border border-[#A35E47]/30">
          <Clock className="w-3 h-3 text-[#A35E47] shrink-0" />
          Expiring Soon
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
        Pending Review
      </span>
    );
  };

  // ─── Grouped Table Columns ──────────────────────────────────────────
  const groupedColumns = [
    { key: 'entity', label: 'PERSON / BUSINESS ENTITY', width: '280px' },
    { key: 'uniqueId', label: 'UNIQUE ID (UID)', width: '180px' },
    { key: 'contact', label: 'CONTACT', width: '170px' },
    { key: 'documents', label: 'KYC DOCUMENTS & VERIFICATION PROGRESS' },
    { key: 'overallStatus', label: 'OVERALL STATUS', width: '140px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  const groupedRows = filteredGrouped.map(entity => {
    const isActionLoadingThis = actionLoading === entity.entityId;
    const isCopied = copiedId === entity.entityId;
    const progressPct = entity.totalDocs > 0 ? Math.round((entity.verifiedDocs / entity.totalDocs) * 100) : 0;

    return {
      entity: (
        <div className="flex items-start gap-2.5 py-1">
          <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] border border-[#E8E8E8] flex items-center justify-center shrink-0 mt-0.5">
            {entity.entityType === 'Vendor' ? (
              <Store className="w-4 h-4 text-amber-800" />
            ) : entity.entityType === 'Rider' ? (
              <Bike className="w-4 h-4 text-blue-700" />
            ) : (
              <User className="w-4 h-4 text-purple-700" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-black text-sm truncate max-w-[210px]" title={entity.entityName}>
                {entity.entityName}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {renderEntityTypeBadge(entity.entityType)}
              {entity.ownerName && entity.entityType === 'Vendor' && (
                <span className="text-[11px] text-[#9C9A9A] truncate max-w-[130px]" title={`Owner: ${entity.ownerName}`}>
                  Owner: {entity.ownerName}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
      uniqueId: (
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-mono-data font-semibold text-[#464646] bg-[#F5F5F5] px-2 py-1 rounded border border-[#E8E8E8] select-all truncate max-w-[130px]"
            title={entity.entityId}
          >
            {entity.entityId.length > 14
              ? `${entity.entityId.slice(0, 8)}...${entity.entityId.slice(-4)}`
              : entity.entityId}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(entity.entityId, `${entity.entityName} UID`);
            }}
            className={`p-1.5 rounded hover:bg-[#E8E8E8] transition-colors cursor-pointer ${isCopied ? 'text-green-600' : 'text-[#9C9A9A]'}`}
            title="Copy Unique ID to clipboard"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
      contact: (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-black font-semibold">
            <Phone className="w-3.5 h-3.5 text-[#A35E47] shrink-0" />
            <span className="font-mono-data text-xs">{entity.phone || '+91 98390 12841'}</span>
          </div>
          {entity.email ? (
            <div className="flex items-center gap-1.5 text-[#9C9A9A] text-[11px] truncate max-w-[160px]" title={entity.email}>
              <Mail className="w-3 h-3 text-[#9C9A9A] shrink-0" />
              <span className="truncate">{entity.email}</span>
            </div>
          ) : null}
        </div>
      ),
      documents: (
        <div className="space-y-1.5 py-1">
          {/* Document chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {entity.documents.map((doc, idx) => {
              const isVer = doc.status === 'Verified';
              const isPend = doc.status === 'Pending';
              const isRej = doc.status === 'Rejected';
              const isExp = doc.status === 'Expiring';

              return (
                <button
                  key={doc.id || idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEntityDrawer(entity, idx);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                    isVer
                      ? 'bg-white border-green-300 text-green-900 hover:bg-green-50'
                      : isPend
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold'
                        : isRej
                          ? 'bg-red-50 border-red-300 text-red-900 hover:bg-red-100'
                          : 'bg-[#FFF8F0] border-[#A35E47]/40 text-[#A35E47] hover:bg-[#FFF8F0]'
                  }`}
                  title={`${doc.type} (${doc.status}) - Click to inspect`}
                >
                  <span className="truncate max-w-[100px]">{doc.type}</span>
                  {isVer && <Check className="w-2.5 h-2.5 text-green-600 shrink-0" />}
                  {isPend && <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                  {isRej && <X className="w-2.5 h-2.5 text-red-600 shrink-0" />}
                  {isExp && <AlertTriangle className="w-2.5 h-2.5 text-[#A35E47] shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Progress bar and counter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-[140px] h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  entity.overallStatus === 'Fully Verified'
                    ? 'bg-black'
                    : entity.overallStatus === 'Action Required'
                      ? 'bg-red-500'
                      : 'bg-[#A35E47]'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-[#464646]">
              {entity.verifiedDocs}/{entity.totalDocs} Verified
            </span>
          </div>
        </div>
      ),
      overallStatus: renderOverallStatusBadge(entity.overallStatus),
      actions: (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {entity.pendingDocs > 0 && (
            <button
              type="button"
              disabled={isActionLoadingThis}
              onClick={() => handleVerifyAllForEntity(entity)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-[#333] transition-colors cursor-pointer disabled:opacity-50"
              title={`Verify all ${entity.pendingDocs} pending documents for this person`}
            >
              {isActionLoadingThis ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-green-400" />
              )}
              Verify All ({entity.pendingDocs})
            </button>
          )}
          <button
            type="button"
            onClick={() => openEntityDrawer(entity, 0)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#A35E47] hover:underline cursor-pointer px-2 py-1.5 rounded hover:bg-[#A35E47]/10"
          >
            Review All
          </button>
        </div>
      ),
      _rawEntity: entity,
    };
  });

  // ─── Individual Table Columns (Flat Queue) ──────────────────────────
  const individualColumns = [
    { key: 'id', label: 'KYC ID', width: '100px' },
    { key: 'entity', label: 'ENTITY' },
    { key: 'entityType', label: 'TYPE', width: '90px' },
    { key: 'type', label: 'DOCUMENT TYPE' },
    { key: 'status', label: 'STATUS', width: '110px' },
    { key: 'submitted', label: 'SUBMITTED', width: '100px' },
    { key: 'expiry', label: 'EXPIRY', width: '110px' },
    { key: 'actions', label: '', width: '100px' },
  ];

  const individualRows = filteredIndividual.map(k => ({
    ...k,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{k.id}</span>,
    entity: (
      <div>
        <span className="font-semibold text-black block">{k.entityName || k.entity}</span>
        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
          {k.phone && (
            <span className="flex items-center gap-1 font-mono-data text-black font-medium">
              <Phone className="w-2.5 h-2.5 text-[#A35E47]" /> {k.phone}
            </span>
          )}
          {k.entityId && (
            <span className="text-[10px] font-mono-data text-[#9C9A9A]">
              · UID: {k.entityId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    ),
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
          onClick={e => { e.stopPropagation(); openDocDrawer(k); }}
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

  // Active document inside the grouped drawer
  const currentEntityDoc = selectedEntity?.documents?.[activeEntityDocIndex] || selectedEntity?.documents?.[0];

  return (
    <div className="p-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      {/* Top Header */}
      <SectionHeader
        title="KYC & Documents Verification"
        subtitle="Identity & compliance verification grouped by Lucknow vendors, delivery partners, and customers"
      >
        <button
          onClick={fetchQueue}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl px-3 py-2 hover:bg-[#F5F5F5] transition-colors cursor-pointer mr-2"
          title="Refresh from database"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <Btn small onClick={handleBulkApprove}>Bulk Approve All</Btn>
        <Btn small danger onClick={handleBulkReject}>Bulk Reject All</Btn>
      </SectionHeader>

      {/* Live Data Indicator */}
      {isSupabaseConfigured && (
        <div className="flex items-center gap-1.5 mb-4 text-[10px] text-[#9C9A9A]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Live data from Supabase · <span className="font-mono">{groupedEntities.length} Distinct Entities</span> · <span className="font-mono">{queue.length} Documents</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label={viewMode === 'grouped' ? 'PENDING ENTITIES' : 'PENDING REVIEW'}
          value={String(
            viewMode === 'grouped'
              ? groupedEntities.filter(g => g.overallStatus === 'Pending Review').length
              : queue.filter(k => k.status === 'Pending').length
          )}
          highlight
        />
        <KPICard
          label="EXPIRING SOON"
          value={String(
            viewMode === 'grouped'
              ? groupedEntities.filter(g => g.overallStatus === 'Expiring').length
              : queue.filter(k => k.status === 'Expiring').length
          )}
          highlight
        />
        <KPICard
          label={viewMode === 'grouped' ? 'ACTION REQUIRED' : 'REJECTED'}
          value={String(
            viewMode === 'grouped'
              ? groupedEntities.filter(g => g.overallStatus === 'Action Required').length
              : queue.filter(k => k.status === 'Rejected').length
          )}
          highlight
        />
        <KPICard
          label={viewMode === 'grouped' ? 'FULLY VERIFIED' : 'VERIFIED DOCS'}
          value={String(
            viewMode === 'grouped'
              ? groupedEntities.filter(g => g.overallStatus === 'Fully Verified').length
              : queue.filter(k => k.status === 'Verified').length
          )}
        />
        <KPICard
          label={viewMode === 'grouped' ? 'TOTAL PERSONS / ENTITIES' : 'TOTAL IN QUEUE'}
          value={String(viewMode === 'grouped' ? groupedEntities.length : queue.length)}
        />
      </div>

      {/* View Switcher Tabs: Grouped by Person vs Individual Documents */}
      <div className="flex items-center justify-between border-b border-[#E8E8E8] pb-3 mb-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grouped'
                ? 'bg-black text-white shadow-sm'
                : 'bg-[#F5F5F5] text-[#464646] hover:bg-[#E8E8E8]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Grouped by Person / Entity ({groupedEntities.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'individual'
                ? 'bg-black text-white shadow-sm'
                : 'bg-[#F5F5F5] text-[#464646] hover:bg-[#E8E8E8]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Individual Documents ({queue.length})
          </button>
        </div>

        <div className="text-xs text-[#9C9A9A]">
          {viewMode === 'grouped' ? (
            <span>Inspect all documents under a single person's UID and verify together</span>
          ) : (
            <span>Flat document queue with individual review</span>
          )}
        </div>
      </div>

      {/* Document Type Breakdown Cards */}
      <div className="border border-[#E8E8E8] rounded-xl p-5 mb-5 bg-[#FAFAFA]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-black">DOCUMENT TYPE BREAKDOWN</p>
          <span className="text-xs text-[#9C9A9A]">Click any type to filter</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {DOC_TYPES.map(d => {
            const isSelected = filterDocType.toLowerCase() === d.type.toLowerCase();
            return (
              <div
                key={d.type}
                onClick={() => setFilterDocType(isSelected ? '' : d.type)}
                className={`flex items-center justify-between border rounded-xl px-4 py-3 bg-white transition-all cursor-pointer hover:border-black ${
                  isSelected ? 'border-black ring-2 ring-black/10' : 'border-[#E8E8E8]'
                }`}
              >
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
            );
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <FilterBar
        onSearch={setSearchQuery}
        filters={[
          {
            label: 'Entity Type',
            options: ['Vendor', 'Rider', 'Customer'],
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

      {/* Main Table / State Render */}
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
      ) : viewMode === 'grouped' ? (
        filteredGrouped.length === 0 ? (
          <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
            <FileText className="w-8 h-8 text-[#9C9A9A] mx-auto mb-2" />
            <p className="text-sm font-bold text-black mb-1">No Matching Entities</p>
            <p className="text-xs text-[#9C9A9A] mb-3">No persons or business entities match the active filters.</p>
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
            columns={groupedColumns}
            rows={groupedRows}
            onRowClick={(row) => openEntityDrawer((row as any)._rawEntity, 0)}
          />
        )
      ) : filteredIndividual.length === 0 ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <FileText className="w-8 h-8 text-[#9C9A9A] mx-auto mb-2" />
          <p className="text-sm font-bold text-black mb-1">No Matching Documents</p>
          <p className="text-xs text-[#9C9A9A] mb-3">No individual documents match the active filter criteria.</p>
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
          columns={individualColumns}
          rows={individualRows}
          onRowClick={(row) => openDocDrawer((row as any)._raw)}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ─── DRAWER 1: GROUPED PERSON KYC REVIEW & VERIFY TOGETHER ────── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <Drawer
        open={entityDrawerOpen && !!selectedEntity}
        onClose={() => {
          setEntityDrawerOpen(false);
          setPreviewUrl(null);
        }}
        title={selectedEntity?.entityName || ''}
        subtitle={`Unique ID: ${selectedEntity?.entityId || ''}`}
        badge={
          selectedEntity ? (
            <div className="flex items-center gap-2">
              {renderEntityTypeBadge(selectedEntity.entityType)}
              {renderOverallStatusBadge(selectedEntity.overallStatus)}
            </div>
          ) : null
        }
      >
        {selectedEntity && (
          <>
            {/* Person Profile & UID Summary */}
            <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-black flex items-center gap-1.5">
                    {selectedEntity.entityType === 'Vendor' ? <Store className="w-3.5 h-3.5 text-amber-700" /> : selectedEntity.entityType === 'Rider' ? <Bike className="w-3.5 h-3.5 text-blue-700" /> : <User className="w-3.5 h-3.5 text-purple-700" />}
                    {selectedEntity.entityName}
                  </p>
                  {selectedEntity.ownerName && selectedEntity.entityType === 'Vendor' && (
                    <p className="text-xs text-[#464646] mt-0.5">
                      Business Owner: <span className="font-semibold">{selectedEntity.ownerName}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedEntity.entityId, `${selectedEntity.entityName} UID`)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-[#E8E8E8] text-[11px] font-mono-data text-[#464646] hover:bg-[#F0F0F0] cursor-pointer"
                  title="Copy Unique ID"
                >
                  <Copy className="w-3 h-3 text-[#9C9A9A]" />
                  <span>{selectedEntity.entityId.slice(0, 8)}...</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#E8E8E8]">
                <div>
                  <span className="text-[#9C9A9A] text-[10px] block">CONTACT PHONE</span>
                  <span className="font-mono-data font-semibold text-[#464646]">{selectedEntity.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-[#9C9A9A] text-[10px] block">EMAIL ADDRESS</span>
                  <span className="truncate block font-semibold text-[#464646]" title={selectedEntity.email}>{selectedEntity.email || '—'}</span>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="pt-2 border-t border-[#E8E8E8]">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-[#9C9A9A]">Verification Progress:</span>
                  <span className="font-bold text-black">
                    {selectedEntity.verifiedDocs} of {selectedEntity.totalDocs} documents verified (
                    {Math.round((selectedEntity.verifiedDocs / selectedEntity.totalDocs) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black rounded-full transition-all duration-300"
                    style={{
                      width: `${(selectedEntity.verifiedDocs / selectedEntity.totalDocs) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── "VERIFY TOGETHER" Hero Action Banner ── */}
            <DrawerSection title="VERIFY TOGETHER">
              {selectedEntity.pendingDocs > 0 ? (
                <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-950">
                        {selectedEntity.pendingDocs} Pending Document{selectedEntity.pendingDocs > 1 ? 's' : ''} Awaiting Review
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Verify all documents together in a single action, or review each document below.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actionLoading === selectedEntity.entityId}
                      onClick={() => handleVerifyAllForEntity(selectedEntity)}
                      className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {actionLoading === selectedEntity.entityId ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Verifying documents in database...
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-4 h-4 text-green-400" />
                          ✓ Verify & Approve All {selectedEntity.pendingDocs} Documents Together
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === selectedEntity.entityId}
                      onClick={() => handleRejectAllForEntity(selectedEntity)}
                      className="w-full py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ✗ Reject All Documents
                    </button>
                  </div>
                </div>
              ) : selectedEntity.overallStatus === 'Fully Verified' ? (
                <div className="border border-green-200 bg-green-50 rounded-xl p-3.5 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-green-950">All Documents Fully Verified</p>
                    <p className="text-[11px] text-green-800">
                      All {selectedEntity.totalDocs} submitted credentials meet RoadRider Lucknow standards.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-red-200 bg-red-50 rounded-xl p-3.5 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-950">Action Required: Document(s) Rejected</p>
                    <p className="text-[11px] text-red-800">
                      Resubmission or document clarification required for compliance approval.
                    </p>
                  </div>
                </div>
              )}
            </DrawerSection>

            {/* ── Document Switcher Tabs for This Person ── */}
            <DrawerSection title={`ALL KYC DOCUMENTS (${selectedEntity.documents.length})`}>
              <div className="space-y-2">
                <p className="text-[11px] text-[#9C9A9A]">
                  Select a document to inspect preview and individual compliance attributes:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {selectedEntity.documents.map((doc, idx) => {
                    const isSelected = activeEntityDocIndex === idx;
                    const isVer = doc.status === 'Verified';
                    const isPend = doc.status === 'Pending';
                    const isRej = doc.status === 'Rejected';

                    return (
                      <button
                        key={doc.id || idx}
                        type="button"
                        onClick={() => {
                          setActiveEntityDocIndex(idx);
                          resolvePreviewUrl(doc);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-sm'
                            : 'bg-white border-[#E8E8E8] text-[#464646] hover:bg-[#F5F5F5]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#9C9A9A]'}`} />
                          <div className="min-w-0">
                            <span className={`text-xs font-bold block truncate ${isSelected ? 'text-white' : 'text-black'}`}>
                              {doc.type}
                            </span>
                            <span className={`text-[10px] font-mono-data ${isSelected ? 'text-gray-300' : 'text-[#9C9A9A]'}`}>
                              {doc.id} · Submitted {doc.submitted}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isVer && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                              isSelected ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                            }`}>
                              <Check className="w-2.5 h-2.5" /> Verified
                            </span>
                          )}
                          {isPend && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                              isSelected ? 'bg-amber-900 text-amber-200' : 'bg-amber-100 text-amber-900'
                            }`}>
                              <Clock className="w-2.5 h-2.5" /> Pending
                            </span>
                          )}
                          {isRej && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                              isSelected ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
                            }`}>
                              <X className="w-2.5 h-2.5" /> Rejected
                            </span>
                          )}
                          {doc.status === 'Expiring' && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                              isSelected ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-900'
                            }`}>
                              <AlertTriangle className="w-2.5 h-2.5" /> Expiring
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </DrawerSection>

            {/* ── Active Document Details & Embedded Preview ── */}
            {currentEntityDoc && (
              <>
                <DrawerSection title={`DOCUMENT INSPECTOR: ${currentEntityDoc.type.toUpperCase()}`}>
                  <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3 space-y-1 text-xs">
                    <DetailRow label="Document ID" value={currentEntityDoc.id} mono />
                    <DetailRow label="Document Type" value={currentEntityDoc.type} />
                    <DetailRow label="Submission" value={currentEntityDoc.submitted} />
                    <DetailRow label="Expiry Date" value={currentEntityDoc.expiry} mono />
                    <DetailRow label="Status" value={<Badge variant={currentEntityDoc.status.toLowerCase()} label={currentEntityDoc.status} showDot />} />
                    {currentEntityDoc.file_name && (
                      <DetailRow label="Attached File" value={currentEntityDoc.file_name} />
                    )}
                    {currentEntityDoc.file_size_bytes && (
                      <DetailRow label="File Size" value={formatFileSize(currentEntityDoc.file_size_bytes)} />
                    )}
                    {currentEntityDoc.rejection_reason && (
                      <DetailRow label="Rejection Reason" value={<span className="text-red-500 font-semibold">{currentEntityDoc.rejection_reason}</span>} />
                    )}
                    {currentEntityDoc.review_notes && (
                      <DetailRow label="Review Notes" value={currentEntityDoc.review_notes} />
                    )}
                  </div>
                </DrawerSection>

                <DrawerSection title="DOCUMENT PREVIEW">
                  <div className="border border-[#E8E8E8] rounded-xl bg-[#F5F5F5] overflow-hidden">
                    {previewLoading ? (
                      <div className="h-48 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-[#A35E47]" />
                        <span className="ml-2 text-xs text-[#9C9A9A]">Loading document preview from storage...</span>
                      </div>
                    ) : previewUrl ? (
                      <div className="flex flex-col">
                        {(currentEntityDoc.mime_type?.includes('pdf') || previewUrl.match(/\.pdf/i)) ? (
                          <div className="h-64 w-full">
                            <iframe
                              src={previewUrl}
                              className="w-full h-full border-0 rounded-t-xl"
                              title="Document PDF Preview"
                            />
                          </div>
                        ) : (
                          <div className="relative group">
                            <img
                              src={previewUrl}
                              alt={`${currentEntityDoc.type} - ${selectedEntity.entityName}`}
                              className="w-full h-auto max-h-72 object-contain bg-white rounded-t-xl p-2"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallbackDiv = document.createElement('div');
                                fallbackDiv.className = 'h-48 flex items-center justify-center text-center p-4';
                                fallbackDiv.innerHTML = `
                                  <div>
                                    <div class="text-3xl mb-1">📄</div>
                                    <p class="text-xs font-bold text-black">${currentEntityDoc.type}</p>
                                    <p class="text-[10px] text-[#9C9A9A]">File loaded from Supabase storage</p>
                                  </div>
                                `;
                                (e.target as HTMLImageElement).parentElement!.appendChild(fallbackDiv);
                              }}
                            />
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
                        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-[#E8E8E8]">
                          <div>
                            <p className="text-xs font-bold text-black">{currentEntityDoc.file_name || currentEntityDoc.type}</p>
                            <p className="text-[10px] text-[#9C9A9A]">
                              Storage Path: <span className="font-mono">{currentEntityDoc.storage_path || 'Direct upload'}</span>
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
                              download={currentEntityDoc.file_name || 'document'}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#A35E47] hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : previewError ? (
                      <div className="h-44 flex flex-col items-center justify-center p-4 text-center">
                        <AlertTriangle className="w-7 h-7 text-amber-500 mb-2" />
                        <p className="text-xs font-bold text-[#464646] mb-1">Document Attachment Preview</p>
                        <p className="text-[11px] text-[#9C9A9A] max-w-xs mb-3">{previewError}</p>
                        {currentEntityDoc.storage_path && (
                          <button
                            onClick={() => resolvePreviewUrl(currentEntityDoc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A35E47] text-white text-xs font-semibold rounded-lg hover:bg-[#8A4F3C] transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry Fetch
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="h-44 flex items-center justify-center p-4 text-center">
                        <div>
                          <div className="text-3xl mb-1">📄</div>
                          <p className="text-xs font-bold text-black">{currentEntityDoc.type}</p>
                          <p className="text-[10px] text-[#9C9A9A]">
                            {currentEntityDoc.storage_path
                              ? 'Document recorded in storage'
                              : 'No attachment uploaded yet'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </DrawerSection>

                {/* Individual actions for this specific document */}
                <DrawerSection title="INDIVIDUAL DOCUMENT ACTIONS">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!!actionLoading || currentEntityDoc.status === 'Verified'}
                      onClick={() => handleVerifySingle(currentEntityDoc)}
                      className="flex-1 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      Approve This Document
                    </button>
                    <button
                      type="button"
                      disabled={!!actionLoading || currentEntityDoc.status === 'Rejected'}
                      onClick={() => handleRejectSingle(currentEntityDoc)}
                      className="flex-1 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject This Document
                    </button>
                  </div>
                </DrawerSection>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ─── DRAWER 2: INDIVIDUAL DOCUMENT REVIEW (FLAT QUEUE MODE) ───── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <Drawer
        open={docDrawerOpen && !!selectedDoc}
        onClose={() => {
          setDocDrawerOpen(false);
          setPreviewUrl(null);
        }}
        title={selectedDoc?.type || ''}
        subtitle={selectedDoc?.entity}
        badge={selectedDoc ? <Badge variant={selectedDoc.status.toLowerCase()} label={selectedDoc.status} showDot /> : null}
      >
        {selectedDoc && (
          <>
            <DrawerSection title="DOCUMENT DETAILS">
              <DetailRow label="KYC ID" value={selectedDoc.id} mono />
              <DetailRow label="Entity" value={selectedDoc.entity} />
              {selectedDoc.entityId && (
                <DetailRow
                  label="Unique ID (UID)"
                  value={
                    <span className="font-mono-data text-xs flex items-center gap-1">
                      {selectedDoc.entityId}
                      <button
                        onClick={() => copyToClipboard(selectedDoc.entityId, 'UID')}
                        className="text-[#A35E47] hover:underline"
                      >
                        [copy]
                      </button>
                    </span>
                  }
                />
              )}
              <DetailRow label="Entity Type" value={selectedDoc.entityType} />
              <DetailRow label="Document" value={selectedDoc.type} />
              <DetailRow label="Submitted" value={selectedDoc.submitted} />
              <DetailRow label="Expiry" value={selectedDoc.expiry} />
              <DetailRow label="Status" value={<Badge variant={selectedDoc.status.toLowerCase()} label={selectedDoc.status} showDot />} />
              {selectedDoc.file_name && (
                <DetailRow label="File" value={selectedDoc.file_name} />
              )}
              {selectedDoc.file_size_bytes && (
                <DetailRow label="Size" value={formatFileSize(selectedDoc.file_size_bytes)} />
              )}
              {selectedDoc.rejection_reason && (
                <DetailRow label="Rejection Reason" value={<span className="text-red-500 text-xs">{selectedDoc.rejection_reason}</span>} />
              )}
              {selectedDoc.review_notes && (
                <DetailRow label="Review Notes" value={<span className="text-xs text-[#464646]">{selectedDoc.review_notes}</span>} />
              )}
              {selectedDoc.verified_at && (
                <DetailRow label="Verified At" value={new Date(selectedDoc.verified_at).toLocaleString('en-IN')} />
              )}
            </DrawerSection>

            <DrawerSection title="DOCUMENT PREVIEW">
              <div className="border border-[#E8E8E8] rounded-xl bg-[#F5F5F5] overflow-hidden">
                {previewLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#A35E47]" />
                    <span className="ml-2 text-xs text-[#9C9A9A]">Loading document from storage...</span>
                  </div>
                ) : previewUrl ? (
                  <div className="flex flex-col">
                    {(selectedDoc.mime_type?.includes('pdf') || previewUrl.match(/\.pdf/i)) ? (
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
                          alt={`${selectedDoc.type} - ${selectedDoc.entity}`}
                          className="w-full h-auto max-h-72 object-contain bg-white rounded-t-xl p-2"
                        />
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
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-[#E8E8E8]">
                      <div>
                        <p className="text-xs font-bold text-black">{selectedDoc.file_name || selectedDoc.type}</p>
                        <p className="text-[10px] text-[#9C9A9A]">From Supabase Storage</p>
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
                          download={selectedDoc.file_name || 'document'}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#A35E47] hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center p-4 text-center">
                    <div>
                      <div className="text-3xl mb-1">📄</div>
                      <p className="text-xs font-bold text-black">{selectedDoc.type}</p>
                      <p className="text-[10px] text-[#9C9A9A]">No preview available</p>
                    </div>
                  </div>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="VERIFICATION ACTIONS">
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => handleVerifySingle(selectedDoc)}
                  disabled={!!actionLoading || selectedDoc.status === 'Verified'}
                  className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating database...</>
                  ) : selectedDoc.status === 'Verified' ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Already Verified</>
                  ) : (
                    '✓ Verify & Approve Document'
                  )}
                </button>
                <button
                  onClick={() => handleRejectSingle(selectedDoc)}
                  disabled={!!actionLoading || selectedDoc.status === 'Rejected'}
                  className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {selectedDoc.status === 'Rejected' ? (
                    <><X className="w-3.5 h-3.5" /> Already Rejected</>
                  ) : (
                    '✗ Reject Document'
                  )}
                </button>
                <button
                  onClick={() => showToast(`Resubmission link dispatched to ${selectedDoc.entity}`)}
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
