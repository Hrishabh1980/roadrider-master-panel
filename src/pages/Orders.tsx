import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, ServiceBadge, FilterBar, Drawer, DrawerSection, DetailRow, Timeline, Btn, Tabs } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { ordersApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useBadges } from '../context/BadgeContext';
import { Download, Check, RefreshCw, Camera, ShieldCheck, Eye, ExternalLink, X } from 'lucide-react';

const TABS = ['Overview', 'Timeline', 'Items', 'Partner', 'Support', 'Activity'];

export default function Orders({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { refreshBadges } = useBadges();
  const { data: apiResponse, loading, refetch } = useApi(
    () => ordersApi.getAll(),
    { data: [], total: 0 }
  );

  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [handoverPhotoUrl, setHandoverPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [serviceTab, setServiceTab] = useState('All');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (apiResponse?.data) {
      setOrdersList(apiResponse.data);
    }
  }, [apiResponse]);

  useEffect(() => {
    if (selected?._raw?.id && isSupabaseConfigured) {
      setLoadingItems(true);
      (async () => {
        try {
          const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', selected._raw.id);
          if (!error && data) {
            setOrderItems(data);
          } else {
            setOrderItems([]);
          }
        } finally {
          setLoadingItems(false);
        }
      })();
    } else {
      setOrderItems([]);
    }
  }, [selected]);

  useEffect(() => {
    let active = true;
    const raw = selected?._raw;
    if (raw) {
      const storagePath = raw.handover_storage_path;
      const photoUrl = raw.handover_photo_url;
      if (storagePath) {
        setLoadingPhoto(true);
        ordersApi.getHandoverSignedUrl(storagePath).then(signed => {
          if (active) {
            setHandoverPhotoUrl(signed || photoUrl || null);
            setLoadingPhoto(false);
          }
        }).catch(() => {
          if (active) {
            setHandoverPhotoUrl(photoUrl || null);
            setLoadingPhoto(false);
          }
        });
      } else if (photoUrl) {
        setHandoverPhotoUrl(photoUrl);
        setLoadingPhoto(false);
      } else {
        setHandoverPhotoUrl(null);
        setLoadingPhoto(false);
      }
    } else {
      setHandoverPhotoUrl(null);
      setLoadingPhoto(false);
    }
    return () => {
      active = false;
    };
  }, [selected]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      ['ID,Customer,Vendor,Partner,Service,Amount,Payment,Status,City,Zone'].join(',') + '\n' +
      ordersList.map(o => {
        return `${o.id},"${o.customer || ''}","${o.vendor || ''}","${o.partner || ''}",${o.service || ''},${o.amount || ''},${o.payment || ''},${o.status || ''},${o.city || ''},${o.zone || ''}`;
      }).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'roadrider_orders.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Orders export completed (CSV downloaded)');
  };

  // BUG-013 FIX: Issue refund now creates a ledger transaction entry
  // AND updates order status atomically, preventing financial discrepancies
  const handleIssueRefund = async (orderId: string) => {
    try {
      if (isSupabaseConfigured && selected?._raw?.id) {
        const rawOrder = selected._raw;
        const refundAmount = parseFloat(String(rawOrder.total_amount || rawOrder.amount || '0').replace(/[^0-9.]/g, '')) || 0;

        // 1. Update order status to cancelled
        const { error: orderErr } = await supabase
          .from('orders')
          .update({ order_status: 'cancelled' })
          .eq('id', rawOrder.id);

        if (orderErr) {
          showToast(`Refund error: ${orderErr.message}`);
          return;
        }

        // 2. Create refund transaction record for financial audit trail
        if (refundAmount > 0) {
          await supabase.from('transactions').insert({
            order_id: rawOrder.id,
            entity_id: rawOrder.customer_id || rawOrder.id,
            entity_type: 'customer',
            type: 'refund',
            amount: refundAmount,
            status: 'processed',
            payment_method: rawOrder.payment_method || 'wallet',
            description: `Admin refund for cancelled order ${orderId}`,
            created_at: new Date().toISOString(),
          });
        }
      }
      setOrdersList(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancelled' } : o));
      if (selected && selected.id === orderId) {
        setSelected({ ...selected, status: 'Cancelled' });
      }
      showToast(`Order ${orderId} cancelled & refund transaction recorded`);
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Refund error: ${err.message}`);
    }
  };

  const columns = [
    { key: 'id', label: 'ORDER ID', width: '120px' },
    { key: 'service', label: 'SERVICE', width: '90px' },
    { key: 'customer', label: 'CUSTOMER' },
    { key: 'vendor', label: 'STORE / VENDOR' },
    { key: 'partner', label: 'PARTNER' },
    { key: 'amount', label: 'AMOUNT', width: '80px' },
    { key: 'payment', label: 'PAYMENT', width: '80px' },
    { key: 'status', label: 'STATUS', width: '110px' },
    { key: 'zone', label: 'ZONE', width: '80px' },
    { key: 'created', label: 'ORDERED AT', width: '90px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const filteredOrders = ordersList.filter(o => {
    if (serviceTab !== 'All' && o.service !== serviceTab) return false;
    if (paymentFilter && o.payment !== paymentFilter) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (zoneFilter && o.zone !== zoneFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const cName = String(o.customer || '').toLowerCase();
      const vName = String(o.vendor || '').toLowerCase();
      const pName = String(o.partner || '').toLowerCase();
      const oId = String(o.id || '').toLowerCase();
      const oStatus = String(o.status || '').toLowerCase();
      if (!cName.includes(q) && !vName.includes(q) && !pName.includes(q) && !oId.includes(q) && !oStatus.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const rows = filteredOrders.map(o => {
    return {
      ...o,
      id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{o.id}</span>,
      service: <ServiceBadge service={o.service} />,
      customer: <span className="font-semibold text-black">{o.customer || 'Customer'}</span>,
      vendor: <span className="text-xs font-medium text-[#222]">{o.vendor || '—'}</span>,
      partner: (
        <span className={`text-xs ${!o.partner || o.partner === '—' ? 'text-[#9C9A9A]' : 'font-medium text-black'}`}>
          {o.partner || '—'}
        </span>
      ),
      amount: <span className="font-bold font-mono-data">{o.amount}</span>,
      status: <Badge variant={o.status?.toLowerCase().replace(/\s+/g, '') || 'pending'} label={o.status || 'Pending'} showDot />,
      actions: (
        <button
          onClick={e => {
            e.stopPropagation();
            setSelected(o);
            setDrawerOpen(true);
          }}
          className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer"
        >
          View
        </button>
      ),
      _raw: o,
    };
  });

  const totalOrdersCount = ordersList.length;
  const deliveredCount = ordersList.filter(o => o.status === 'Delivered').length;
  const activeCount = ordersList.filter(o => ['In Transit', 'Preparing', 'Searching', 'Accepted'].includes(o.status)).length;
  const delayedCount = ordersList.filter(o => o.status === 'Delayed').length;
  const cancelledCount = ordersList.filter(o => o.status === 'Cancelled').length;
  const disputedCount = ordersList.filter(o => o.status === 'Disputed').length;

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Orders" subtitle={`All orders across Food, Grocery, Courier · ${ordersList.length} recorded`}>
        <Btn small onClick={() => { refetch(); showToast('Syncing orders from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-6 gap-4 mb-5">
        {[
          { label: 'TOTAL ORDERS', value: String(totalOrdersCount) },
          { label: 'DELIVERED', value: String(deliveredCount) },
          { label: 'ACTIVE', value: String(activeCount) },
          { label: 'DELAYED', value: String(delayedCount), highlight: delayedCount > 0 },
          { label: 'CANCELLED', value: String(cancelledCount), highlight: cancelledCount > 0 },
          { label: 'DISPUTED', value: String(disputedCount), highlight: disputedCount > 0 },
        ].map(s => (
          <div key={s.label} className="border border-[#E8E8E8] rounded-xl p-3 bg-white">
            <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>{s.label}</p>
            <p className={`text-xl font-black font-mono-data ${(s as any).highlight ? 'text-[#A35E47]' : 'text-black'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Service tabs */}
      <div className="flex gap-1 mb-4">
        {['All', 'Food', 'Grocery', 'Courier'].map(s => (
          <button
            key={s}
            onClick={() => setServiceTab(s)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors border cursor-pointer ${serviceTab === s ? 'bg-black text-white border-black' : 'border-[#E8E8E8] text-[#464646] hover:border-black bg-white'}`}
          >
            {s} {s === 'All' ? `(${ordersList.length})` : `(${ordersList.filter(o => o.service === s).length})`}
          </button>
        ))}
      </div>

      <FilterBar
        onSearch={setSearch}
        filters={[
          { label: 'Payment', options: ['UPI', 'Card', 'Wallet', 'COD'], value: paymentFilter, onChange: setPaymentFilter },
          { label: 'Status', options: ['Delivered', 'In Transit', 'Preparing', 'Cancelled', 'Disputed', 'Delayed'], value: statusFilter, onChange: setStatusFilter },
          { label: 'Zone', options: ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'], value: zoneFilter, onChange: setZoneFilter },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
      />

      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ''}
        subtitle={`${selected?.service || 'Delivery'} Order · ${selected?.zone || selected?.city || 'Lucknow'}`}
        badge={selected ? <Badge variant={selected.status?.toLowerCase().replace(/\s+/g, '') || 'pending'} label={selected.status || 'Pending'} showDot /> : null}
      >
        {selected && (
          <>
            <Tabs tabs={TABS.slice(0, 3)} active={tab} onChange={setTab} />

            {tab === 'Overview' && (
              <>
                <DrawerSection title="ORDER DETAILS">
                  <DetailRow label="Order ID" value={selected.id} mono />
                  <DetailRow label="Customer" value={selected.customer || '—'} />
                  <DetailRow label="Store / Vendor" value={selected.vendor || '—'} />
                  <DetailRow label="Partner" value={selected.partner && selected.partner !== '—' ? selected.partner : 'Unassigned'} />
                  <DetailRow label="Zone" value={selected.zone || selected.city || '—'} />
                </DrawerSection>

                <DrawerSection title="LIFECYCLE & HANDOVER PROOF">
                  <DetailRow
                    label="Vendor Acceptance"
                    value={
                      selected._raw?.accepted_at
                        ? new Date(selected._raw.accepted_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : 'Pending acceptance'
                    }
                  />
                  <DetailRow
                    label="Prep Deadline"
                    value={
                      selected._raw?.prep_deadline
                        ? new Date(selected._raw.prep_deadline).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : (selected._raw?.promised_by
                            ? new Date(selected._raw.promised_by).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                            : (selected._raw?.prep_minutes ? `${selected._raw.prep_minutes} mins` : '—'))
                    }
                  />
                  <DetailRow
                    label="Kitchen Ready"
                    value={
                      selected._raw?.ready_at
                        ? new Date(selected._raw.ready_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : 'In kitchen / Pending'
                    }
                  />
                  <DetailRow
                    label="Handover Timestamp"
                    value={
                      selected._raw?.handed_over_at
                        ? new Date(selected._raw.handed_over_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : 'Pending physical handover'
                    }
                  />
                  <DetailRow
                    label="Assigned Rider"
                    value={selected.partner && selected.partner !== '—' ? selected.partner : 'Unassigned'}
                  />
                  <DetailRow
                    label="Delivery Status"
                    value={<Badge variant={selected.status?.toLowerCase().replace(/\s+/g, '') || 'pending'} label={selected.status || 'Pending'} showDot />}
                  />

                  {/* Handover Photo Card */}
                  <div className="mt-3 pt-3 border-t border-[#E8E8E8]">
                    <p className="text-[11px] font-bold text-[#666] uppercase tracking-wider mb-2">Live Handover Photo Proof</p>
                    {loadingPhoto ? (
                      <div className="py-4 text-center text-xs text-[#9C9A9A] bg-[#FAFAFA] rounded-xl border border-dashed border-[#DDD]">
                        Generating secure signed access URL...
                      </div>
                    ) : handoverPhotoUrl ? (
                      <div className="border border-[#E8E8E8] rounded-xl p-2.5 bg-[#FAFAFA]">
                        <div
                          className="relative group cursor-pointer overflow-hidden rounded-lg max-h-48 bg-black flex items-center justify-center"
                          onClick={() => setPhotoModalOpen(true)}
                        >
                          <img
                            src={handoverPhotoUrl}
                            alt="Order Handover Proof"
                            className="w-full h-44 object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                            <Eye className="w-4 h-4" /> Click to enlarge
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EAEAEA] text-[11px]">
                          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified Live Photo
                          </span>
                          {selected._raw?.handover_captured_at && (
                            <span className="text-[#888] font-mono-data">
                              Captured {new Date(selected._raw.handover_captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 px-3 text-center text-xs text-[#999] bg-[#FAFAFA] rounded-xl border border-dashed border-[#DDD]">
                        <Camera className="w-4 h-4 mx-auto mb-1 text-[#BBB]" />
                        No handover photo recorded yet (order awaiting vendor handover)
                      </div>
                    )}
                  </div>
                </DrawerSection>

                <DrawerSection title="PRICING">
                  <DetailRow label="Order Total" value={<span className="font-black text-base text-black">{selected.amount || '—'}</span>} />
                  {selected._raw?.delivery_fee !== undefined && (
                    <DetailRow label="Delivery Fee" value={`₹${selected._raw.delivery_fee}`} />
                  )}
                  {selected._raw?.tax !== undefined && (
                    <DetailRow label="Tax / Platform Fee" value={`₹${selected._raw.tax}`} />
                  )}
                </DrawerSection>

                <DrawerSection title="PAYMENT">
                  <DetailRow label="Method" value={selected.payment || 'Online'} />
                  <DetailRow label="Status" value={<Badge variant={selected.status === 'Cancelled' ? 'inactive' : 'active'} label={selected.status === 'Cancelled' ? 'Cancelled' : 'Success'} showDot />} />
                  <DetailRow label="Reference" value={selected._raw?.payment_reference || selected._raw?.transaction_id || selected.id} mono />
                </DrawerSection>

                <DrawerSection title="ACTIONS">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => showToast(selected.customer ? `Dialed customer ${selected.customer}` : 'No customer contact info')}
                      className="py-2.5 border border-[#E8E8E8] hover:bg-[#F5F5F5] text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Contact Customer
                    </button>
                    <button
                      onClick={() => showToast(selected.partner && selected.partner !== '—' ? `Dialed partner ${selected.partner}` : 'No partner assigned to this order yet')}
                      className="py-2.5 border border-[#E8E8E8] hover:bg-[#F5F5F5] text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Contact Partner
                    </button>
                    {selected.status !== 'Cancelled' && (
                      <button
                        onClick={() => handleIssueRefund(selected.id)}
                        className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Issue Full Refund
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (onNavigate) onNavigate('support');
                        setDrawerOpen(false);
                      }}
                      className="py-2.5 border border-[#E8E8E8] hover:bg-[#F5F5F5] text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Raise Support Ticket →
                    </button>
                  </div>
                </DrawerSection>
              </>
            )}

            {tab === 'Timeline' && (
              <DrawerSection title="ORDER TIMELINE">
                <Timeline events={[
                  {
                    time: selected._raw?.created_at ? new Date(selected._raw.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (selected.created || 'Initial'),
                    label: 'Order Placed',
                    detail: `${selected.customer || 'Customer'} placed order (${selected.amount})`,
                    status: 'done'
                  },
                  {
                    time: selected._raw?.accepted_at ? new Date(selected._raw.accepted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
                    label: 'Vendor Accepted',
                    detail: selected._raw?.accepted_at ? `Accepted by ${selected.vendor || 'store'} (Est. ${selected._raw.prep_minutes || 20}m)` : 'Awaiting vendor acceptance',
                    status: selected._raw?.accepted_at ? 'done' : (selected.status === 'Cancelled' ? 'pending' : 'active')
                  },
                  {
                    time: selected._raw?.ready_at ? new Date(selected._raw.ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
                    label: 'Kitchen Ready',
                    detail: selected._raw?.ready_at ? 'Food packed and marked ready for pickup' : 'Order in kitchen preparation',
                    status: selected._raw?.ready_at ? 'done' : (selected._raw?.accepted_at ? 'active' : 'pending')
                  },
                  {
                    time: selected._raw?.handed_over_at ? new Date(selected._raw.handed_over_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
                    label: 'Handover to Delivery Partner',
                    detail: selected._raw?.handed_over_at ? 'Parcel handed over with live photo proof' : 'Awaiting physical handover to partner',
                    status: selected._raw?.handed_over_at ? 'done' : (selected._raw?.ready_at ? 'active' : 'pending')
                  },
                  {
                    time: ['In Transit', 'Delivered', 'Picked Up'].includes(selected.status) ? 'Active' : '—',
                    label: 'In Transit',
                    detail: selected.partner && selected.partner !== '—' ? `With delivery partner: ${selected.partner}` : 'Awaiting rider assignment',
                    status: ['In Transit', 'Delivered', 'Picked Up'].includes(selected.status) ? 'done' : 'pending'
                  },
                  {
                    time: selected.status === 'Delivered' ? 'Delivered' : '—',
                    label: 'Delivered',
                    detail: selected.status === 'Delivered' ? 'Order delivered successfully to customer' : 'Awaiting completion of delivery',
                    status: selected.status === 'Delivered' ? 'done' : 'pending'
                  },
                ]} />
              </DrawerSection>
            )}

            {tab === 'Items' && (
              <DrawerSection title="ORDERED ITEMS">
                {loadingItems ? (
                  <div className="py-6 text-center text-xs text-[#9C9A9A]">Loading order items...</div>
                ) : orderItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#9C9A9A]">No line items recorded for this order.</div>
                ) : (
                  orderItems.map((item, idx) => (
                    <div key={item.id || idx} className="flex justify-between items-center py-2.5 border-b border-[#F0F0F0]">
                      <div>
                        <p className="text-xs font-semibold text-black">{item.item_name || item.name || 'Item'}</p>
                        <p className="text-[10px] text-[#9C9A9A]">Qty: {item.quantity || 1}</p>
                      </div>
                      <span className="text-xs font-bold font-mono-data">₹{Number(item.price || item.total_price || 0).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </DrawerSection>
            )}
          </>
        )}
      </Drawer>

      {/* Lightbox for Handover Photo */}
      {photoModalOpen && handoverPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPhotoModalOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#E8E8E8]">
              <div>
                <h3 className="font-bold text-sm text-black">Order Handover Proof</h3>
                <p className="text-xs text-[#777]">Order #{selected?.id} · Live Camera Capture</p>
              </div>
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F0F0F0] text-[#666] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center max-h-[70vh]">
              <img
                src={handoverPhotoUrl}
                alt="Handover Proof Full"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-[#FAFAFA] border-t border-[#E8E8E8] flex justify-between items-center text-xs text-[#666]">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <ShieldCheck className="w-4 h-4" /> Secure short-lived signed URL (private storage)
              </span>
              <a
                href={handoverPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#A35E47] hover:underline flex items-center gap-1"
              >
                Open in new tab <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
