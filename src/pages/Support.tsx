import React, { useState, useEffect, useMemo } from 'react';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, Tabs, KPICard, Timeline } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { supportApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import {
  Plus, Check, X, RefreshCw, Phone, User, Clock, MessageSquare, Send,
  CheckCircle2, AlertTriangle, ShieldCheck, Copy, Store, Building2, ExternalLink
} from 'lucide-react';
import { useBadges } from '../context/BadgeContext';

interface VendorOption {
  id: string; // Vendor UID
  name: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  email?: string;
  vendorType?: string;
  onboardingStatus?: string;
}

export default function Support({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { refreshBadges } = useBadges();
  const { data: ticketsResponse, loading, refetch } = useApi(
    () => supportApi.getTickets(),
    { data: [], total: 0 }
  );

  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [drawerTab, setDrawerTab] = useState('Conversation');
  const [replyText, setReplyText] = useState('');
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('All Vendors');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [statusFilter, setStatusFilter] = useState('All Status');

  // New ticket state with name, phone number, attached vendor, and optional order id
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [requesterType, setRequesterType] = useState('Customer');
  const [type, setType] = useState('Order Issues');
  const [priority, setPriority] = useState('Medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customVendorName, setCustomVendorName] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [initialAdminMessage, setInitialAdminMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Attach vendor on existing ticket state
  const [attachVendorModal, setAttachVendorModal] = useState(false);
  const [attachModalVendorId, setAttachModalVendorId] = useState('');
  const [attachModalVendorName, setAttachModalVendorName] = useState('');
  const [isAttachingVendor, setIsAttachingVendor] = useState(false);

  // Live registered vendors list
  const [vendorList, setVendorList] = useState<VendorOption[]>([
    {
      id: '98a1b2c3-d4e5-4f6a-b7c8-9d0e1f2a3b4c',
      name: 'Baba Dhaba (Main Outlet)',
      businessName: 'Baba Dhaba (Main Outlet)',
      ownerName: 'Ramesh Gupta',
      phone: '+91 98001 23456',
      email: 'babadhaba@roadrider.internal',
      vendorType: 'Restaurant',
      onboardingStatus: 'active',
    },
    {
      id: 'freshmart-8821-uuid',
      name: 'FreshMart Superstore',
      businessName: 'FreshMart Superstore',
      ownerName: 'Sunil Agarwal',
      phone: '+91 98002 34567',
      email: 'freshmart@roadrider.internal',
      vendorType: 'Grocery Superstore',
      onboardingStatus: 'active',
    },
    {
      id: 'spicegarden-7712-uuid',
      name: 'Spice Garden Dining',
      businessName: 'Spice Garden Dining',
      ownerName: 'Neeraj Pandey',
      phone: '+91 98003 45678',
      email: 'spicegarden@roadrider.internal',
      vendorType: 'Fine Dining Restaurant',
      onboardingStatus: 'active',
    },
    {
      id: 'quickbites-3310-uuid',
      name: 'Quick Bites Express',
      businessName: 'Quick Bites Express',
      ownerName: 'Mohd. Salim',
      phone: '+91 98004 56789',
      email: 'quickbites@roadrider.internal',
      vendorType: 'Fast Food Outlet',
      onboardingStatus: 'active',
    },
  ]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase
        .from('vendors')
        .select('id, name, business_name, owner_name, phone, email, vendor_type, onboarding_status')
        .then(r => {
          if (r.data && r.data.length > 0) {
            setVendorList(
              r.data.map((v: any) => ({
                id: String(v.id),
                name: v.business_name || v.name || v.owner_name || 'Vendor Store',
                businessName: v.business_name || v.name || 'Vendor Store',
                ownerName: v.owner_name || '—',
                phone: v.phone || undefined,
                email: v.email || undefined,
                vendorType: v.vendor_type || 'Restaurant / Merchant',
                onboardingStatus: v.onboarding_status || 'active',
              }))
            );
          }
        });
    }
  }, []);

  useEffect(() => {
    if (ticketsResponse?.data) {
      setTickets(ticketsResponse.data);
      // If a ticket is currently selected, update its reference with latest data
      if (selected) {
        const updatedSelected = ticketsResponse.data.find(
          (t: any) => t.id === selected.id || (t._dbId && t._dbId === selected._dbId)
        );
        if (updatedSelected) {
          setSelected(updatedSelected);
        }
      }
    }
  }, [ticketsResponse]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`);
    }
  };

  const tabs = ['Overview', 'All Tickets', 'Customer Issues', 'Vendor Issues', 'Partner Issues', 'Payment Issues'];

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !subject.trim()) {
      showToast('Please provide Requester Name, Phone Number, and Subject.');
      return;
    }

    let finalVendorId: string | undefined = undefined;

    if (selectedVendorId === 'custom') {
      finalVendorId = customVendorName.trim() || undefined;
    } else if (selectedVendorId) {
      finalVendorId = selectedVendorId;
    }

    setCreatingTicket(true);
    try {
      await supportApi.createTicket({
        name: name.trim(),
        phone: phone.trim(),
        requesterType: requesterType.trim(),
        subject: subject.trim(),
        category: type,
        priority: priority.toLowerCase(),
        description: description.trim() || `Inquiry reported by ${name.trim()} (${phone.trim()})`,
        adminMessage: initialAdminMessage.trim() || undefined,
        vendorId: finalVendorId,
        orderId: orderIdInput.trim() || undefined,
      });

      showToast(`Support ticket created with Vendor UID in DB`);
      setNewTicketModal(false);
      setName('');
      setPhone('');
      setSubject('');
      setDescription('');
      setSelectedVendorId('');
      setCustomVendorName('');
      setOrderIdInput('');
      setInitialAdminMessage('');
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error creating ticket: ${err.message}`);
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleAttachVendor = async () => {
    if (!selected) return;
    const ticketDbId = selected._dbId || selected.id;

    let finalId = attachModalVendorId;
    const found = vendorList.find(v => v.id === attachModalVendorId);
    let finalName = found?.name || attachModalVendorName;
    let finalPhone = found?.phone || selected.vendorPhone;

    setIsAttachingVendor(true);
    try {
      await supportApi.attachVendor(ticketDbId, finalId);
      const updatedTicket = {
        ...selected,
        vendorId: finalId,
        vendorName: finalName,
        vendorPhone: finalPhone,
        vendor: found || selected.vendor,
        updated: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        updatedAt: new Date().toISOString(),
      };
      setSelected(updatedTicket);
      setTickets(prev =>
        prev.map(t => (t.id === selected.id || t._dbId === ticketDbId) ? updatedTicket : t)
      );
      showToast(`Vendor UID ${finalId} attached to ticket ${selected.id} in database`);
      setAttachVendorModal(false);
      refetch();
    } catch (err: any) {
      showToast(`Error attaching vendor: ${err.message}`);
    } finally {
      setIsAttachingVendor(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selected) {
      showToast('Please type an admin response before recording.');
      return;
    }

    const ticketDbId = selected._dbId || selected.id;
    setIsSavingReply(true);
    try {
      await supportApi.respondToTicket(ticketDbId, {
        adminMessage: replyText.trim(),
        status: selected.status === 'Open' ? 'in_progress' : undefined,
      });

      const nowFormatted = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const updatedTicket = {
        ...selected,
        adminMessage: replyText.trim(),
        updated: nowFormatted,
        updatedAt: new Date().toISOString(),
        status: selected.status === 'Open' ? 'In Progress' : selected.status,
      };

      setSelected(updatedTicket);
      setTickets(prev =>
        prev.map(t => (t.id === selected.id || t._dbId === ticketDbId) ? updatedTicket : t)
      );

      showToast(`Admin response stored in admin_message column & updated timestamp logged`);
      setReplyText('');
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error saving admin message: ${err.message}`);
    } finally {
      setIsSavingReply(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    const ticketDbId = selected?._dbId || selected?.id || ticketId;
    try {
      const resolutionMessage = replyText.trim() || selected?.adminMessage || 'Issue investigated and resolved by operations admin.';
      await supportApi.resolve(ticketDbId, resolutionMessage, replyText.trim() || undefined);

      const nowFormatted = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const updatedTicket = {
        ...selected,
        status: 'Resolved',
        adminMessage: replyText.trim() || selected?.adminMessage || resolutionMessage,
        resolution: resolutionMessage,
        updated: nowFormatted,
        updatedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
      };

      setSelected(updatedTicket);
      setTickets(prev =>
        prev.map(t => (t.id === ticketId || t._dbId === ticketDbId) ? updatedTicket : t)
      );

      showToast(`Ticket ${ticketId} marked as Resolved (admin_message & updated timestamp stored)`);
      setReplyText('');
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error resolving ticket: ${err.message}`);
    }
  };

  const handleEscalate = async (ticketId: string) => {
    const ticketDbId = selected?._dbId || selected?.id || ticketId;
    try {
      await supportApi.escalate(ticketDbId, replyText.trim() || undefined);

      const nowFormatted = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const updatedTicket = {
        ...selected,
        status: 'Escalated',
        priority: 'High',
        adminMessage: replyText.trim() || selected?.adminMessage || null,
        updated: nowFormatted,
        updatedAt: new Date().toISOString(),
      };

      setSelected(updatedTicket);
      setTickets(prev =>
        prev.map(t => (t.id === ticketId || t._dbId === ticketDbId) ? updatedTicket : t)
      );

      showToast(`Ticket ${ticketId} escalated to Priority Queue (updated timestamp logged)`);
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error escalating ticket: ${err.message}`);
    }
  };

  // Filtered tickets based on tab, vendor filter, priority filter, status filter, and search
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // 1. Tab filter
      const catStr = t.category != null ? String(t.category).toLowerCase() : '';
      const reqTypeStr = t.requesterType != null ? String(t.requesterType).toLowerCase() : '';
      if (tab === 'Customer Issues') {
        const match =
          catStr.includes('customer') ||
          catStr.includes('order') ||
          reqTypeStr === 'customer';
        if (!match) return false;
      } else if (tab === 'Vendor Issues') {
        const match =
          catStr.includes('vendor') ||
          catStr.includes('store') ||
          reqTypeStr === 'vendor' ||
          Boolean(t.vendorName);
        if (!match) return false;
      } else if (tab === 'Partner Issues') {
        const match =
          catStr.includes('partner') ||
          catStr.includes('rider') ||
          reqTypeStr === 'partner';
        if (!match) return false;
      } else if (tab === 'Payment Issues') {
        const match =
          catStr.includes('payment') ||
          catStr.includes('refund');
        if (!match) return false;
      }

      // 2. Vendor filter
      if (vendorFilter !== 'All Vendors') {
        if (t.vendorName !== vendorFilter) return false;
      }

      // 3. Priority filter
      if (priorityFilter !== 'All Priority') {
        if ((t.priority != null ? String(t.priority).toLowerCase() : '') !== priorityFilter.toLowerCase()) return false;
      }

      // 4. Status filter
      if (statusFilter !== 'All Status') {
        if ((t.status != null ? String(t.status).toLowerCase() : '') !== statusFilter.toLowerCase()) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          (t.id && String(t.id).toLowerCase().includes(q)) ||
          (t.subject && String(t.subject).toLowerCase().includes(q)) ||
          (t.description && String(t.description).toLowerCase().includes(q)) ||
          (t.requesterName && String(t.requesterName).toLowerCase().includes(q)) ||
          (t.requesterPhone && String(t.requesterPhone).toLowerCase().includes(q)) ||
          (t.vendorName && String(t.vendorName).toLowerCase().includes(q)) ||
          (t.vendorId && String(t.vendorId).toLowerCase().includes(q)) ||
          (t.orderId && String(t.orderId).toLowerCase().includes(q)) ||
          (t.adminMessage && String(t.adminMessage).toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [tickets, tab, vendorFilter, priorityFilter, statusFilter, searchQuery]);

  const columns = [
    { key: 'id', label: 'TICKET ID', width: '115px' },
    { key: 'subject', label: 'SUBJECT / ISSUE' },
    { key: 'requester', label: 'REQUESTER & PHONE', width: '200px' },
    { key: 'vendor', label: 'ATTACHED VENDOR', width: '210px' },
    { key: 'adminMsg', label: 'ADMIN RESPONSE (IN DB)', width: '220px' },
    { key: 'category', label: 'CATEGORY', width: '130px' },
    { key: 'priority', label: 'PRIORITY', width: '90px' },
    { key: 'status', label: 'STATUS', width: '110px' },
    { key: 'created', label: 'CREATED AT', width: '140px' },
    { key: 'actions', label: 'ACTION', width: '70px' },
  ];

  const rows = filteredTickets.map(t => ({
    ...t,
    id: <span className="text-xs font-mono-data font-bold text-[#464646]">{t.id}</span>,
    subject: (
      <div>
        <p className="font-semibold text-xs text-black">{t.subject || 'Support Request'}</p>
        <p className="text-[10px] text-[#9C9A9A] line-clamp-1">{t.description}</p>
        {t.orderId && (
          <span className="text-[9px] font-mono-data text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
            Order: {t.orderId}
          </span>
        )}
      </div>
    ),
    requester: (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-black">{t.requesterName || t.requester}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F5F5F5] font-semibold text-[#464646]">
            {t.requesterType || 'Customer'}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-[#9C9A9A] font-mono-data">
          <Phone className="w-3 h-3 text-[#A35E47]" />
          <span>{t.requesterPhone || '—'}</span>
        </div>
      </div>
    ),
    vendor: (
      t.vendorName ? (
        <div>
          <div className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-[#A35E47] shrink-0" />
            <span className="font-bold text-xs text-black truncate max-w-[140px]">{t.vendorName}</span>
          </div>
          {t.vendorId && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-[#9C9A9A] font-mono-data truncate max-w-[120px]">
                {String(t.vendorId).slice(0, 14)}...
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  copyToClipboard(t.vendorId, 'Vendor ID');
                }}
                className="text-[#9C9A9A] hover:text-black p-0.5 rounded cursor-pointer"
                title="Copy Vendor UUID"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setSelected(t);
            setAttachModalVendorId('');
            setAttachModalVendorName('');
            setAttachVendorModal(true);
          }}
          className="text-[11px] font-bold text-[#A35E47] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Attach Vendor
        </button>
      )
    ),
    adminMsg: (
      t.adminMessage ? (
        <div className="p-1.5 rounded-lg bg-[#F0FDF4] border border-green-200 text-xs">
          <p className="text-[10px] font-bold text-green-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-600" /> Stored in DB
          </p>
          <p className="text-[11px] text-green-950 font-medium line-clamp-1 mt-0.5">{t.adminMessage}</p>
        </div>
      ) : (
        <span className="text-xs text-[#9C9A9A] italic">Awaiting response</span>
      )
    ),
    category: <span className="text-xs text-[#464646] font-medium">{t.category}</span>,
    priority: <Badge variant={t.priority != null ? String(t.priority).toLowerCase() : 'medium'} label={t.priority != null ? String(t.priority) : 'Medium'} />,
    status: <Badge variant={t.status != null ? String(t.status).toLowerCase().replace(/\s+/g, '') : 'open'} label={t.status != null ? String(t.status) : 'Open'} showDot />,
    created: <span className="text-xs font-mono-data text-[#464646]">{t.created}</span>,
    actions: (
      <button
        onClick={e => {
          e.stopPropagation();
          setSelected(t);
          setReplyText(t.adminMessage || '');
          setDrawerOpen(true);
        }}
        className="text-xs font-bold text-[#A35E47] hover:underline cursor-pointer"
      >
        Open
      </button>
    ),
    _raw: t,
  }));

  const openTicketsCount = tickets.filter(t => t.status !== 'Resolved').length;
  const vendorAttachedCount = tickets.filter(t => Boolean(t.vendorName || t.vendorId)).length;
  const adminRespondedCount = tickets.filter(t => Boolean(t.adminMessage)).length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  const distinctVendorNames = useMemo(() => {
    const names = new Set<string>();
    tickets.forEach(t => {
      if (t.vendorName) names.add(t.vendorName);
    });
    vendorList.forEach(v => {
      if (v.name) names.add(v.name);
    });
    return Array.from(names);
  }, [tickets, vendorList]);

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader
        title="Support Center"
        subtitle={`Manage customer, delivery partner, and merchant support tickets with live database audit · ${tickets.length} recorded`}
      >
        <Btn small onClick={() => { refetch(); showToast('Refreshing support tickets from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn variant="primary" small onClick={() => setNewTicketModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Ticket
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="TOTAL TICKETS" value={String(tickets.length)} sub="All logged cases" />
        <KPICard label="OPEN TICKETS" value={String(openTicketsCount)} highlight={openTicketsCount > 0} sub="Pending resolution" />
        <KPICard label="ATTACHED TO VENDORS" value={String(vendorAttachedCount)} sub="Merchant linked in DB" />
        <KPICard label="ADMIN RESPONDED" value={String(adminRespondedCount)} sub="Logged in admin_message" />
      </div>

      {/* Filter Bar with Vendor Filter & Search */}
      <FilterBar
        onSearch={setSearchQuery}
        filters={[
          {
            label: 'Vendor',
            options: ['All Vendors', ...distinctVendorNames],
            value: vendorFilter,
            onChange: setVendorFilter,
          },
          {
            label: 'Priority',
            options: ['All Priority', 'High', 'Medium', 'Low'],
            value: priorityFilter,
            onChange: setPriorityFilter,
          },
          {
            label: 'Status',
            options: ['All Status', 'Open', 'In Progress', 'Resolved', 'Escalated'],
            value: statusFilter,
            onChange: setStatusFilter,
          },
        ]}
      />

      {filteredTickets.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No matching support tickets found. Adjust your search or filters.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={row => {
            const raw = (row as any)._raw;
            setSelected(raw);
            setReplyText(raw.adminMessage || '');
            setDrawerOpen(true);
          }}
        />
      )}

      {/* Ticket Details Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={`${selected?.id} — ${selected?.subject || selected?.category}`}
        subtitle={`${selected?.requesterName || selected?.requester} · ${selected?.requesterPhone || ''}`}
        badge={selected ? (
          <div className="flex gap-1.5">
            <Badge variant={selected.priority != null ? String(selected.priority).toLowerCase() : 'medium'} label={selected.priority != null ? String(selected.priority) : 'Medium'} />
            <Badge variant={selected.status != null ? String(selected.status).toLowerCase().replace(/\s+/g, '') : 'open'} label={selected.status != null ? String(selected.status) : 'Open'} showDot />
          </div>
        ) : null}
      >
        {selected && (
          <>
            <Tabs tabs={['Conversation', 'Context', 'Timeline']} active={drawerTab} onChange={setDrawerTab} />

            {drawerTab === 'Conversation' && (
              <div className="space-y-4">
                {/* Attached Vendor Intelligence Banner */}
                {selected.vendorId ? (
                  <div className="p-3.5 rounded-xl bg-[#FFF8F0] border border-[#A35E47]/30 text-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-[#A35E47] text-white shrink-0 mt-0.5">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#A35E47]">Attached Vendor (UID Verified)</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FDEEE9] font-bold text-[#A35E47]">
                              {selected.vendor?.vendorType || 'Merchant'}
                            </span>
                          </div>
                          <p className="font-extrabold text-sm text-black mt-0.5">
                            {selected.vendor?.businessName || selected.vendorName || 'Vendor Store'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-[#464646] font-mono-data bg-white/90 px-2 py-0.5 rounded border border-[#E8E8E8]">
                              UID: {selected.vendorId}
                            </span>
                            <button
                              onClick={() => copyToClipboard(selected.vendorId, 'Vendor UID')}
                              className="p-1 hover:bg-[#F5F5F5] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                              title="Copy Vendor UID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          {(selected.vendor?.ownerName || selected.vendorPhone || selected.vendor?.phone) && (
                            <div className="pt-1.5 text-[11px] text-[#464646] space-y-0.5 font-mono-data">
                              {selected.vendor?.ownerName && selected.vendor.ownerName !== '—' && (
                                <p className="text-[#464646]">Owner: <span className="font-bold text-black">{selected.vendor.ownerName}</span></p>
                              )}
                              {(selected.vendorPhone || selected.vendor?.phone) && (
                                <p className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-[#A35E47]" />
                                  <span>Phone: {selected.vendorPhone || selected.vendor?.phone}</span>
                                </p>
                              )}
                              {selected.vendor?.email && (
                                <p className="text-[#9C9A9A]">Email: {selected.vendor.email}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('vendors')}
                            className="px-2.5 py-1 bg-black text-white text-[11px] font-bold rounded-lg hover:bg-[#333] cursor-pointer flex items-center gap-1"
                            title="Jump to Vendors management module"
                          >
                            <span>Open Vendor Profile</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setAttachModalVendorId(selected.vendorId || '');
                            setAttachModalVendorName(selected.vendorName || '');
                            setAttachVendorModal(true);
                          }}
                          className="text-[11px] font-bold text-[#A35E47] hover:underline cursor-pointer"
                        >
                          Change Vendor UID
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#F5F5F5] border border-[#E8E8E8] text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-black flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        No Vendor Attached
                      </p>
                      <p className="text-[11px] text-[#9C9A9A]">Link ticket to a Vendor UID so all vendor records can be resolved</p>
                    </div>
                    <button
                      onClick={() => {
                        setAttachModalVendorId('');
                        setAttachModalVendorName('');
                        setAttachVendorModal(true);
                      }}
                      className="px-3 py-1.5 bg-[#A35E47] text-white text-[11px] font-bold rounded-lg hover:bg-[#8e4f3a] cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Attach Vendor UID
                    </button>
                  </div>
                )}

                {/* Linked Order Banner if present */}
                {selected.orderId && (
                  <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-blue-800 uppercase">Linked Order</span>
                      <span className="font-mono-data text-xs font-bold text-blue-950">{selected.orderId}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyToClipboard(selected.orderId, 'Order ID')}
                        className="p-1 hover:bg-blue-100 rounded text-blue-700 cursor-pointer"
                        title="Copy Order ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('orders')}
                          className="text-[11px] font-bold text-blue-800 hover:underline cursor-pointer flex items-center gap-0.5"
                        >
                          <span>View Order</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* User Inquiry Box */}
                <div className="bg-[#F5F5F5] rounded-xl p-4 border border-[#E8E8E8]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E0E0E0]">
                    <div>
                      <p className="text-xs font-bold text-black flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#A35E47]" />
                        {selected.requesterName || selected.requester}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-[#464646] font-semibold">
                          {selected.requesterType || 'Customer'}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#9C9A9A] font-mono-data mt-0.5">
                        Phone: {selected.requesterPhone || '—'}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono-data text-[#9C9A9A]">
                      {selected.created}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-black mb-1">{selected.subject}</p>
                  <p className="text-xs text-[#464646] leading-relaxed">{selected.description}</p>
                </div>

                {/* Stored Admin Response Box */}
                {selected.adminMessage ? (
                  <div className="bg-[#F0FDF4] rounded-xl p-4 border border-green-300 shadow-xs">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-green-600 text-white">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-green-950 uppercase tracking-wider">
                            Official Admin Response (Stored in Table)
                          </p>
                          <p className="text-[10px] text-green-800 font-mono-data">
                            Column: admin_message · Last Updated: {selected.updated || selected.created}
                          </p>
                        </div>
                      </div>
                      <Badge variant="completed" label="Stored in DB" showDot />
                    </div>
                    <p className="text-xs text-green-950 font-medium leading-relaxed whitespace-pre-wrap">
                      {selected.adminMessage}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Awaiting Admin Response</p>
                      <p className="text-[11px] text-amber-800">
                        No admin response is recorded in the <code className="font-mono">admin_message</code> column yet. Type a response below to store it.
                      </p>
                    </div>
                  </div>
                )}

                {/* Reply / Update Response Box */}
                <div className="pt-2 border-t border-[#E8E8E8]">
                  <label className="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
                    <span>{selected.adminMessage ? 'Update Admin Response (admin_message)' : 'Compose Admin Response (Stored in DB)'}</span>
                    <span className="text-[10px] text-[#9C9A9A]">Updates updated_at automatically</span>
                  </label>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type official response to requester or resolution notes. This will be stored directly into the admin_message column in Supabase..."
                    className="w-full border border-[#9C9A9A] rounded-xl p-3 text-xs resize-none h-28 outline-none focus:border-black font-sans leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={isSavingReply}
                      className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSavingReply ? 'Saving to DB...' : 'Save Admin Message & Update'}
                    </button>
                    {selected.status !== 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => handleResolve(selected.id)}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved with Message
                      </button>
                    )}
                    {selected.status !== 'Escalated' && (
                      <button
                        type="button"
                        onClick={() => handleEscalate(selected.id)}
                        className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Priority
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'Context' && (
              <div className="space-y-6">
                <DrawerSection title="ATTACHED VENDOR DETAILS">
                  {(selected.vendorId || selected.vendorName) ? (
                    <>
                      <DetailRow
                        label="Vendor / Store Name"
                        value={
                          <span className="font-bold text-black flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-[#A35E47]" />
                            {selected.vendor?.businessName || selected.vendorName || 'Vendor Store'}
                          </span>
                        }
                      />
                      <DetailRow
                        label="Vendor UID (in DB)"
                        value={
                          <div className="flex items-center gap-2">
                            <span className="font-mono-data text-xs text-[#464646] font-bold">{selected.vendorId || '—'}</span>
                            {selected.vendorId && (
                              <button
                                onClick={() => copyToClipboard(selected.vendorId, 'Vendor UID')}
                                className="p-1 hover:bg-[#F5F5F5] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                                title="Copy Vendor UID"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        }
                      />
                      {selected.vendor?.ownerName && selected.vendor.ownerName !== '—' && (
                        <DetailRow label="Owner / Merchant" value={selected.vendor.ownerName} />
                      )}
                      {(selected.vendorPhone || selected.vendor?.phone) && (
                        <DetailRow
                          label="Vendor Phone"
                          value={
                            <div className="flex items-center gap-2">
                              <span className="font-mono-data text-xs text-black font-bold">{selected.vendorPhone || selected.vendor?.phone}</span>
                              <button
                                onClick={() => copyToClipboard(selected.vendorPhone || selected.vendor?.phone, 'Vendor Phone')}
                                className="p-1 hover:bg-[#F5F5F5] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                                title="Copy Vendor Phone"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          }
                        />
                      )}
                      {selected.vendor?.email && (
                        <DetailRow label="Vendor Email" value={selected.vendor.email} />
                      )}
                      {selected.vendor?.vendorType && (
                        <DetailRow label="Business Category" value={selected.vendor.vendorType} />
                      )}
                      {selected.vendor?.onboardingStatus && (
                        <DetailRow
                          label="Account Status"
                          value={
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {selected.vendor.onboardingStatus}
                            </span>
                          }
                        />
                      )}
                      <div className="pt-2 flex items-center gap-3">
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('vendors')}
                            className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>Open Vendor in Admin Panel</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setAttachModalVendorId(selected.vendorId || '');
                            setAttachModalVendorName(selected.vendorName || '');
                            setAttachVendorModal(true);
                          }}
                          className="text-xs font-bold text-[#A35E47] hover:underline cursor-pointer"
                        >
                          Change Vendor UID
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-[#F9F9F9] rounded-xl border border-[#E8E8E8] flex items-center justify-between">
                      <span className="text-xs text-[#9C9A9A]">No vendor attached to this inquiry.</span>
                      <button
                        onClick={() => {
                          setAttachModalVendorId('');
                          setAttachModalVendorName('');
                          setAttachVendorModal(true);
                        }}
                        className="text-xs font-bold text-[#A35E47] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Attach Vendor UID
                      </button>
                    </div>
                  )}
                </DrawerSection>

                <DrawerSection title="REQUESTER CREDENTIALS">
                  <DetailRow label="Requester Full Name" value={selected.requesterName || selected.requester} />
                  <DetailRow
                    label="Phone Number"
                    value={
                      <div className="flex items-center gap-2">
                        <span className="font-mono-data font-bold text-black">{selected.requesterPhone || '—'}</span>
                        {selected.requesterPhone && (
                          <button
                            onClick={() => copyToClipboard(selected.requesterPhone, 'Phone number')}
                            className="p-1 hover:bg-[#F5F5F5] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                            title="Copy phone"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    }
                  />
                  <DetailRow label="Requester Role" value={selected.requesterType || 'Customer'} />
                  {selected._raw?.customer_id && (
                    <DetailRow label="Customer UUID" value={selected._raw.customer_id} mono />
                  )}
                  {selected._raw?.partner_id && (
                    <DetailRow label="Partner UUID" value={selected._raw.partner_id} mono />
                  )}
                </DrawerSection>

                <DrawerSection title="TICKET SPECIFICATIONS">
                  <DetailRow label="Ticket Number" value={selected.id} mono />
                  <DetailRow label="Subject" value={selected.subject} />
                  <DetailRow label="Category" value={selected.category} />
                  <DetailRow label="Priority" value={<Badge variant={selected.priority != null ? String(selected.priority).toLowerCase() : 'medium'} label={selected.priority != null ? String(selected.priority) : 'Medium'} />} />
                  <DetailRow label="Status" value={<Badge variant={selected.status != null ? String(selected.status).toLowerCase().replace(/\s+/g, '') : 'open'} label={selected.status != null ? String(selected.status) : 'Open'} showDot />} />
                  {selected.orderId && (
                    <DetailRow
                      label="Linked Order"
                      value={
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-xs text-blue-900 font-bold">{selected.orderId}</span>
                          <button
                            onClick={() => copyToClipboard(selected.orderId, 'Order ID')}
                            className="p-1 hover:bg-[#F5F5F5] rounded text-[#9C9A9A] hover:text-black cursor-pointer"
                            title="Copy Order ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      }
                    />
                  )}
                </DrawerSection>

                <DrawerSection title="STORED ADMIN MESSAGE">
                  {selected.adminMessage ? (
                    <div className="p-3 bg-[#F0FDF4] rounded-lg border border-green-200 text-xs text-green-950 font-medium">
                      {selected.adminMessage}
                    </div>
                  ) : (
                    <p className="text-xs text-[#9C9A9A] italic">No admin response recorded in database</p>
                  )}
                </DrawerSection>

                <DrawerSection title="SYSTEM TIMESTAMPS">
                  <DetailRow label="Created At" value={selected.created || '—'} mono />
                  <DetailRow label="Last Updated At" value={selected.updated || selected.created || '—'} mono />
                  {selected.resolvedAt && (
                    <DetailRow label="Resolved At" value={new Date(selected.resolvedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} mono />
                  )}
                </DrawerSection>
              </div>
            )}

            {drawerTab === 'Timeline' && (
              <DrawerSection title="TICKET AUDIT TIMELINE">
                <Timeline events={[
                  {
                    time: selected.created,
                    label: 'Ticket Filed & Logged in Table',
                    detail: `${selected.requesterName || selected.requester} (${selected.requesterPhone || 'Phone unrecorded'})`,
                    status: 'done',
                  },
                  ...(selected.vendorName ? [{
                    time: selected.created,
                    label: `Vendor Attached: ${selected.vendorName}`,
                    detail: `Vendor ID: ${selected.vendorId || 'UUID linked in DB'}`,
                    status: 'done' as const,
                  }] : []),
                  ...(selected.adminMessage ? [{
                    time: selected.updated || selected.created,
                    label: 'Admin Response Stored (admin_message)',
                    detail: selected.adminMessage,
                    status: 'done' as const,
                  }] : []),
                  {
                    time: selected.status === 'Resolved' ? (selected.updated || 'Recently') : 'Current',
                    label: `Status: ${selected.status || 'Open'}`,
                    status: selected.status === 'Resolved' ? 'done' as const : 'active' as const,
                  },
                ]} />
              </DrawerSection>
            )}
          </>
        )}
      </Drawer>

      {/* Attach Vendor Modal */}
      {attachVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-[#E8E8E8] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E8E8]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#FFF8F0] text-[#A35E47]">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-black">Attach Vendor to Ticket</h3>
                  <p className="text-xs text-[#9C9A9A]">Link ticket #{selected?.id} to merchant in database</p>
                </div>
              </div>
              <button onClick={() => setAttachVendorModal(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5] text-[#9C9A9A] hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Select Registered Vendor</label>
                <select
                  value={attachModalVendorId}
                  onChange={e => {
                    const vid = e.target.value;
                    setAttachModalVendorId(vid);
                    if (vid && vid !== 'custom') {
                      const found = vendorList.find(v => v.id === vid);
                      setAttachModalVendorName(found?.name || '');
                    }
                  }}
                  className="w-full text-xs p-2 rounded-xl border border-[#9C9A9A] bg-white outline-none focus:border-black cursor-pointer"
                >
                  <option value="">Select Vendor...</option>
                  {vendorList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                  <option value="custom">+ Enter Custom Vendor</option>
                </select>
              </div>

              {attachModalVendorId === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Custom Vendor Name</label>
                    <input
                      value={attachModalVendorName}
                      onChange={e => setAttachModalVendorName(e.target.value)}
                      placeholder="e.g. Baba Dhaba Express"
                      className="w-full text-xs p-2 rounded-xl border border-[#9C9A9A] outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">Custom Vendor UUID (Optional)</label>
                    <input
                      value={attachModalVendorId === 'custom' ? '' : attachModalVendorId}
                      onChange={e => setAttachModalVendorId(e.target.value)}
                      placeholder="e.g. 98a1b2c3-d4e5-4f6a-..."
                      className="w-full text-xs p-2 rounded-xl border border-[#9C9A9A] outline-none focus:border-black font-mono-data"
                    />
                  </div>
                </>
              )}

              {attachModalVendorId && attachModalVendorId !== 'custom' && (
                <div className="p-3 bg-[#F9F9F9] rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#9C9A9A]">Selected Vendor:</span>
                    <span className="font-bold text-black">{attachModalVendorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9C9A9A]">Vendor UUID:</span>
                    <span className="font-mono-data text-xs text-[#464646]">{attachModalVendorId}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAttachVendorModal(false)}
                className="px-4 py-2 border border-[#9C9A9A] text-xs font-semibold rounded-xl hover:border-black cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachVendor}
                disabled={isAttachingVendor || (!attachModalVendorId && !attachModalVendorName)}
                className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] cursor-pointer disabled:opacity-50"
              >
                {isAttachingVendor ? 'Saving to DB...' : 'Attach Vendor & Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal with Name, Phone, and Attached Vendor */}
      {newTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-[#E8E8E8] animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E8E8]">
              <div>
                <h3 className="font-black text-base text-black">Create Support Ticket</h3>
                <p className="text-xs text-[#9C9A9A]">Stores requester name, phone number, attached vendor, and timestamps in database</p>
              </div>
              <button onClick={() => setNewTicketModal(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5] text-[#9C9A9A] hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Requester Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none focus:border-black font-mono-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Requester Type</label>
                  <select
                    value={requesterType}
                    onChange={e => {
                      const val = e.target.value;
                      setRequesterType(val);
                      if (val === 'Vendor' && vendorList.length > 0) {
                        const firstV = vendorList[0];
                        setSelectedVendorId(firstV.id);
                        setName(firstV.businessName || firstV.name);
                        setPhone(firstV.phone || '');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none bg-white cursor-pointer"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Partner">Delivery Partner</option>
                    <option value="Vendor">Vendor / Store</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Category</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none bg-white cursor-pointer"
                  >
                    <option value="Order Issues">Order Issues</option>
                    <option value="Payment Issues">Payment Issues</option>
                    <option value="Vendor Issues">Vendor Issues</option>
                    <option value="Partner Issues">Partner Issues</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none bg-white cursor-pointer"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Attach Vendor UID Section */}
              <div className="p-3 bg-[#F9F9F9] rounded-xl border border-[#E8E8E8]">
                <label className="block text-xs font-bold text-black mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[#A35E47]" />
                    <span>Attach Vendor UID (Stored in DB: vendor_id)</span>
                  </span>
                  <span className="text-[10px] text-[#9C9A9A]">Normalized Relational FK</span>
                </label>
                <select
                  value={selectedVendorId}
                  onChange={e => {
                    const vid = e.target.value;
                    setSelectedVendorId(vid);
                    if (vid && vid !== 'custom') {
                      const found = vendorList.find(v => v.id === vid);
                      if (found && requesterType === 'Vendor') {
                        setName(found.businessName || found.name);
                        setPhone(found.phone || '');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none bg-white cursor-pointer"
                >
                  <option value="">None (No Vendor Attached)</option>
                  {vendorList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} (UID: {v.id.slice(0, 8)}...)
                    </option>
                  ))}
                  <option value="custom">+ Custom Vendor UID</option>
                </select>

                {selectedVendorId === 'custom' && (
                  <div className="mt-2">
                    <input
                      value={customVendorName}
                      onChange={e => setCustomVendorName(e.target.value)}
                      placeholder="Enter custom vendor UUID…"
                      className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none focus:border-black font-mono-data"
                    />
                  </div>
                )}
                {selectedVendorId && selectedVendorId !== 'custom' && (() => {
                  const v = vendorList.find(item => item.id === selectedVendorId);
                  return v ? (
                    <div className="mt-2 p-2.5 bg-white rounded-lg border border-[#E8E8E8] text-[11px] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-black">{v.businessName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#F5F5F5] font-semibold text-[#464646] rounded">
                          {v.vendorType || 'Merchant'}
                        </span>
                      </div>
                      <div className="flex justify-between font-mono-data text-[10px] text-[#464646]">
                        <span>Vendor UID (in DB):</span>
                        <span className="font-bold">{v.id}</span>
                      </div>
                      {v.phone && (
                        <div className="flex justify-between font-mono-data text-[10px] text-[#464646]">
                          <span>Contact:</span>
                          <span>{v.phone}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-[#9C9A9A] italic pt-0.5">
                        Ticket is linked to this UID. The app dynamically fetches all owner, contact, store, and order details.
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Optional Linked Order ID */}
              <div>
                <label className="block text-xs font-bold text-black mb-1 flex items-center justify-between">
                  <span>Linked Order ID (Optional)</span>
                  <span className="text-[10px] text-[#9C9A9A]">e.g. ORD-8941</span>
                </label>
                <input
                  value={orderIdInput}
                  onChange={e => setOrderIdInput(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000 or ORD-8941"
                  className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none focus:border-black font-mono-data"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Subject / Issue Summary <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Delayed food order or item missing at restaurant"
                  className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Description / Customer Statement</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed notes on what the customer/partner reported…"
                  className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none resize-none h-18 focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1 flex items-center justify-between">
                  <span>Initial Admin Response (Saved to admin_message)</span>
                  <span className="text-[10px] text-[#9C9A9A]">Optional</span>
                </label>
                <textarea
                  value={initialAdminMessage}
                  onChange={e => setInitialAdminMessage(e.target.value)}
                  placeholder="Optional immediate resolution message or internal note to be stored in admin_message column…"
                  className="w-full px-3 py-2 text-xs border border-[#9C9A9A] rounded-xl outline-none resize-none h-16 focus:border-black"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#E8E8E8]">
                <button
                  type="button"
                  onClick={() => setNewTicketModal(false)}
                  className="flex-1 py-2.5 border border-[#9C9A9A] text-xs font-semibold rounded-xl hover:border-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] cursor-pointer disabled:opacity-50"
                >
                  {creatingTicket ? 'Submitting to Table...' : 'Submit Ticket to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
