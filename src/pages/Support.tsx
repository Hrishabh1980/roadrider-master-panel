import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, Tabs, KPICard, Timeline } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { supportApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Plus, Check, X, RefreshCw } from 'lucide-react';
import { useBadges } from '../context/BadgeContext';

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
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New ticket state
  const [requester, setRequester] = useState('');
  const [type, setType] = useState('Order Issues');
  const [priority, setPriority] = useState('Medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (ticketsResponse?.data) {
      setTickets(ticketsResponse.data);
    }
  }, [ticketsResponse]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = ['Overview', 'All Tickets', 'Customer Issues', 'Vendor Issues', 'Partner Issues', 'Payment Issues'];

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requester.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('support_tickets').insert({
          subject: subject.trim() || type,
          description: description.trim() || `Issue reported by ${requester.trim()}`,
          category: type,
          priority: priority.toLowerCase(),
          status: 'open',
          requester_type: requester.trim(),
        }).select().single();

        if (error) {
          showToast(`Error creating ticket: ${error.message}`);
          return;
        }

        showToast('Support ticket created successfully');
        setNewTicketModal(false);
        setRequester('');
        setSubject('');
        setDescription('');
        refetch();
        refreshBadges();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selected) return;
    showToast(`Reply sent to ${selected.requester}`);
    setReplyText('');
  };

  const handleResolve = async (ticketId: string) => {
    try {
      if (isSupabaseConfigured && selected?._raw?.id) {
        await supabase
          .from('support_tickets')
          .update({ status: 'resolved' })
          .eq('id', selected._raw.id);
      }
      setTickets(prev => prev.map(t => (t.id === ticketId || t._raw?.id === ticketId) ? { ...t, status: 'Resolved' } : t));
      if (selected) {
        setSelected({ ...selected, status: 'Resolved' });
      }
      showToast(`Ticket ${ticketId} marked as Resolved`);
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleEscalate = async (ticketId: string) => {
    try {
      if (isSupabaseConfigured && selected?._raw?.id) {
        await supabase
          .from('support_tickets')
          .update({ status: 'escalated', priority: 'high' })
          .eq('id', selected._raw.id);
      }
      setTickets(prev => prev.map(t => (t.id === ticketId || t._raw?.id === ticketId) ? { ...t, status: 'Escalated', priority: 'High' } : t));
      if (selected) {
        setSelected({ ...selected, status: 'Escalated', priority: 'High' });
      }
      showToast(`Ticket ${ticketId} escalated to Priority Queue`);
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const columns = [
    { key: 'id', label: 'TICKET ID', width: '110px' },
    { key: 'subject', label: 'SUBJECT / ISSUE' },
    { key: 'requester', label: 'REQUESTER' },
    { key: 'category', label: 'CATEGORY' },
    { key: 'priority', label: 'PRIORITY', width: '90px' },
    { key: 'status', label: 'STATUS', width: '110px' },
    { key: 'created', label: 'CREATED' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const rows = tickets.map(t => ({
    ...t,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{t.id}</span>,
    subject: <span className="font-semibold text-xs text-black">{t.subject || 'Support Request'}</span>,
    requester: <span className="text-xs text-[#464646]">{t.requester}</span>,
    category: <span className="text-xs text-[#9C9A9A]">{t.category}</span>,
    priority: <Badge variant={t.priority?.toLowerCase() || 'medium'} label={t.priority || 'Medium'} />,
    status: <Badge variant={t.status?.toLowerCase().replace(/\s+/g, '') || 'open'} label={t.status || 'Open'} showDot />,
    actions: (
      <button onClick={e => { e.stopPropagation(); setSelected(t); setDrawerOpen(true); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">Open</button>
    ),
    _raw: t,
  }));

  const openTicketsCount = tickets.filter(t => t.status !== 'Resolved').length;
  const highPriorityCount = tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Support Center" subtitle={`Manage all customer, vendor, and delivery partner support tickets · ${tickets.length} recorded`}>
        <Btn small onClick={() => { refetch(); showToast('Refreshing tickets from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn variant="primary" small onClick={() => setNewTicketModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Ticket
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard label="TOTAL TICKETS" value={String(tickets.length)} />
            <KPICard label="OPEN TICKETS" value={String(openTicketsCount)} highlight={openTicketsCount > 0} />
            <KPICard label="HIGH PRIORITY" value={String(highPriorityCount)} highlight={highPriorityCount > 0} />
            <KPICard label="RESOLVED" value={String(resolvedCount)} />
          </div>

          {tickets.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No support tickets found in database.
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
            />
          )}
        </>
      )}

      {(tab === 'All Tickets' || tab === 'Customer Issues' || tab === 'Vendor Issues' || tab === 'Partner Issues' || tab === 'Payment Issues') && (
        <>
          <FilterBar
            filters={[
              { label: 'Priority', options: ['High', 'Medium', 'Low'] },
              { label: 'Status', options: ['Open', 'In Progress', 'Resolved', 'Escalated'] },
            ]}
          />
          <DataTable
            columns={columns}
            rows={rows.filter(r => {
              if (tab === 'Customer Issues') return r.category?.toLowerCase().includes('customer') || r.category?.toLowerCase().includes('order');
              if (tab === 'Vendor Issues') return r.category?.toLowerCase().includes('vendor') || r.category?.toLowerCase().includes('store');
              if (tab === 'Partner Issues') return r.category?.toLowerCase().includes('partner') || r.category?.toLowerCase().includes('rider');
              if (tab === 'Payment Issues') return r.category?.toLowerCase().includes('payment') || r.category?.toLowerCase().includes('payout');
              return true;
            })}
            onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
          />
        </>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={`${selected?.id} — ${selected?.subject || selected?.category}`}
        subtitle={`${selected?.requester} · ${selected?.created}`}
        badge={selected ? (
          <div className="flex gap-1.5">
            <Badge variant={selected.priority?.toLowerCase() || 'medium'} label={selected.priority || 'Medium'} />
            <Badge variant={selected.status?.toLowerCase().replace(/\s+/g, '') || 'open'} label={selected.status || 'Open'} showDot />
          </div>
        ) : null}
      >
        {selected && (
          <>
            <Tabs tabs={['Conversation', 'Context', 'Timeline']} active={drawerTab} onChange={setDrawerTab} />

            {drawerTab === 'Conversation' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="bg-[#F5F5F5] rounded-xl p-3.5">
                    <p className="text-xs font-bold text-[#464646] mb-1">{selected.requester} · {selected.created}</p>
                    <p className="text-xs text-black">{selected.description || selected.subject}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type official response or support notes…"
                    className="w-full border border-[#E8E8E8] rounded-xl p-3 text-xs resize-none h-24 outline-none focus:border-black"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSendReply}
                      className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] cursor-pointer"
                    >
                      Record Reply
                    </button>
                    {selected.status !== 'Resolved' && (
                      <button
                        onClick={() => handleResolve(selected.id)}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
                      >
                        ✓ Mark Resolved
                      </button>
                    )}
                    {selected.status !== 'Escalated' && (
                      <button
                        onClick={() => handleEscalate(selected.id)}
                        className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 cursor-pointer"
                      >
                        Escalate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'Context' && (
              <DrawerSection title="TICKET DETAILS">
                <DetailRow label="Ticket ID" value={selected.id} mono />
                <DetailRow label="Subject" value={selected.subject} />
                <DetailRow label="Category" value={selected.category} />
                <DetailRow label="Priority" value={<Badge variant={selected.priority?.toLowerCase() || 'medium'} label={selected.priority || 'Medium'} />} />
                <DetailRow label="Status" value={<Badge variant={selected.status?.toLowerCase().replace(/\s+/g, '') || 'open'} label={selected.status || 'Open'} showDot />} />
                <DetailRow label="Requester" value={selected.requester} />
                <DetailRow label="Created At" value={selected.created} />
              </DrawerSection>
            )}

            {drawerTab === 'Timeline' && (
              <DrawerSection title="TICKET TIMELINE">
                <Timeline events={[
                  { time: selected.created, label: 'Ticket Filed', detail: selected.requester, status: 'done' },
                  { time: 'Status', label: selected.status || 'Open', status: selected.status === 'Resolved' ? 'done' : 'active' },
                ]} />
              </DrawerSection>
            )}
          </>
        )}
      </Drawer>

      {/* New Ticket Modal */}
      {newTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Create Support Ticket</h3>
              <button onClick={() => setNewTicketModal(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Subject / Issue Summary *</label>
                <input
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Delayed delivery or refund issue"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Requester Type / Name *</label>
                <input
                  required
                  value={requester}
                  onChange={e => setRequester(e.target.value)}
                  placeholder="e.g. Customer Neha Verma or Vendor Baba Dhaba"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Category</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none bg-white"
                  >
                    <option value="Order Issues">Order Issues</option>
                    <option value="Payment Issues">Payment Issues</option>
                    <option value="Vendor Issues">Vendor Issues</option>
                    <option value="Partner Issues">Partner Issues</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none bg-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Details of the support inquiry…"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none resize-none h-20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setNewTicketModal(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
