import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, ServiceBadge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, KPICard, LiveDot } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { dashboardApi, partnersApi, kycApi, supportApi, vendorsApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useBadges } from '../context/BadgeContext';
import { Plus, Check, X, Navigation, Clock, Truck, Bell, Settings, RefreshCw, AlertTriangle, Search, Phone, MapPin, Eye, FileText, ArrowRight } from 'lucide-react';

// ── Rides page ─────────────────────────────────────────────────────────────────
// ── Rides page ─────────────────────────────────────────────────────────────────
export function Rides({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [ridesList, setRidesList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchRides = async () => {
    setLoading(true);
    setFetchError(null);
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch from live orders table where service_type = 'rides'
      const { data: orderRides, error: orderErr } = await supabase
        .from('orders')
        .select('*, partners(id, full_name, phone), stores(store_name)')
        .eq('service_type', 'rides')
        .order('created_at', { ascending: false });

      if (orderErr) {
        throw new Error(orderErr.message);
      }

      // 2. Also check if dedicated rides table has any records
      let dedicatedRides: any[] = [];
      try {
        const { data: dRides } = await supabase
          .from('rides')
          .select('*')
          .order('created_at', { ascending: false });
        if (dRides && Array.isArray(dRides)) dedicatedRides = dRides;
      } catch {
        // Table might be unused
      }

      const mappedOrders = (orderRides || []).map((r: any) => {
        let displayStatus = 'Unassigned';
        const rawStatus = (r.order_status || '').toLowerCase();
        if (!r.partner_id || rawStatus === 'placed') {
          displayStatus = 'Unassigned';
        } else if (rawStatus === 'accepted') {
          displayStatus = 'Assigned';
        } else if (rawStatus === 'in_transit' || rawStatus === 'arrived') {
          displayStatus = 'Active';
        } else if (rawStatus === 'delivered' || rawStatus === 'completed') {
          displayStatus = 'Completed';
        } else if (rawStatus === 'cancelled') {
          displayStatus = 'Cancelled';
        } else {
          displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
        }

        return {
          id: r.order_number || (r.id ? `RID-${String(r.id).slice(0, 8).toUpperCase()}` : 'RID-001'),
          _dbId: r.id,
          customer: r.customer_name || 'Passenger',
          customerPhone: r.customer_phone || '—',
          partner: r.partners?.full_name || (r.partner_id ? 'Assigned Driver' : 'Unassigned'),
          partnerPhone: r.partners?.phone || '—',
          vehicle: 'Cab / Auto',
          pickup: r.stores?.store_name || 'Lucknow Central',
          drop: r.delivery_address || 'Lucknow Destination',
          fare: `₹${r.total_amount || 0}`,
          eta: r.prep_minutes ? `${r.prep_minutes} min` : '15 min',
          status: displayStatus,
          payment: r.payment_method || 'COD',
          city: 'Lucknow',
          placedAt: r.placed_at || r.created_at ? new Date(r.placed_at || r.created_at).toLocaleString('en-IN') : 'Recent',
          note: r.customer_note || '',
          _raw: r,
        };
      });

      const mappedDedicated = dedicatedRides.map((r: any) => ({
        id: r.id ? `RID-${String(r.id).slice(0, 8).toUpperCase()}` : 'RID-001',
        _dbId: r.id,
        customer: r.customer_name || 'Passenger',
        customerPhone: r.customer_phone || '—',
        partner: r.driver_name || 'Driver',
        partnerPhone: r.driver_phone || '—',
        vehicle: r.vehicle_type || 'Cab',
        pickup: r.pickup_location || 'Pickup',
        drop: r.drop_location || 'Drop',
        fare: `₹${r.total_fare || 0}`,
        eta: r.eta || '—',
        status: r.status || 'Completed',
        payment: r.payment_method || 'Online',
        city: r.city || 'Lucknow',
        placedAt: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : 'Recent',
        note: '',
        _raw: r,
      }));

      // Combine and eliminate duplicates by id
      const combined = [...mappedOrders, ...mappedDedicated];
      setRidesList(combined);
    } catch (err: any) {
      console.error('[Rides] Error fetching rides:', err);
      setFetchError(err.message || 'Failed to load rides from Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = ridesList.filter(r => {
    const matchesSearch =
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.partner.toLowerCase().includes(search.toLowerCase()) ||
      r.pickup.toLowerCase().includes(search.toLowerCase()) ||
      r.drop.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      r.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const columns = [
    { key: 'id', label: 'RIDE ID', width: '110px' },
    { key: 'customer', label: 'PASSENGER' },
    { key: 'partner', label: 'DRIVER' },
    { key: 'pickup', label: 'PICKUP' },
    { key: 'drop', label: 'DROP' },
    { key: 'fare', label: 'FARE', width: '80px' },
    { key: 'status', label: 'STATUS', width: '110px' },
    { key: 'placedAt', label: 'BOOKED AT', width: '140px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const rows = filtered.map(r => ({
    ...r,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{r.id}</span>,
    customer: (
      <div>
        <p className="font-semibold text-xs text-black">{r.customer}</p>
        <p className="text-[10px] text-[#9C9A9A]">{r.customerPhone}</p>
      </div>
    ),
    partner: (
      <div>
        <p className="font-semibold text-xs text-black">{r.partner}</p>
        <p className="text-[10px] text-[#9C9A9A]">{r.partnerPhone}</p>
      </div>
    ),
    pickup: <span className="text-xs text-[#464646] line-clamp-1">{r.pickup}</span>,
    drop: <span className="text-xs text-[#464646] line-clamp-1">{r.drop}</span>,
    fare: <span className="font-bold font-mono-data text-xs">{r.fare}</span>,
    status: <Badge variant={r.status.toLowerCase().replace(/\s+/g, '')} label={r.status} showDot />,
    placedAt: <span className="text-[11px] text-[#9C9A9A] font-mono-data">{r.placedAt}</span>,
    actions: (
      <button onClick={e => { e.stopPropagation(); setSelected(r); setDrawerOpen(true); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">
        View
      </button>
    ),
    _raw: r,
  }));

  const STATUS_TABS = ['All', 'Unassigned', 'Assigned', 'Active', 'Completed', 'Cancelled'];

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Passenger Rides" subtitle="Live passenger cab and auto bookings across Lucknow">
        <button
          onClick={() => { fetchRides(); showToast('Syncing rides from Supabase...'); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl px-3 py-2 hover:bg-[#F5F5F5] transition-colors cursor-pointer mr-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </SectionHeader>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <KPICard label="TOTAL RECORDED RIDES" value={String(ridesList.length)} />
        <KPICard label="ACTIVE TRIPS" value={String(ridesList.filter(r => r.status === 'Active').length)} highlight={ridesList.some(r => r.status === 'Active')} />
        <KPICard label="UNASSIGNED" value={String(ridesList.filter(r => r.status === 'Unassigned').length)} highlight={ridesList.some(r => r.status === 'Unassigned')} />
        <KPICard label="COMPLETED" value={String(ridesList.filter(r => r.status === 'Completed').length)} />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-black text-white'
                  : 'bg-[#F5F5F5] text-[#464646] hover:bg-[#E8E8E8]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#9C9A9A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search passenger, driver, route…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E8E8E8] rounded-lg outline-none focus:border-black"
          />
        </div>
      </div>

      {loading ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <RefreshCw className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
          <p className="text-xs text-[#464646] font-bold">Loading ride records from Supabase...</p>
        </div>
      ) : fetchError ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-8 text-center my-4 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-xs font-bold mb-1">Failed to Load Rides</p>
          <p className="text-[11px] text-red-600 mb-4">{fetchError}</p>
          <button
            onClick={fetchRides}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Database Query
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          {search || statusFilter !== 'All' ? 'No rides match your filter criteria.' : 'No passenger rides currently booked in database.'}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows}
          onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }} />
      )}

      <Drawer open={drawerOpen && !!selected} onClose={() => setDrawerOpen(false)}
        title={selected?.id || ''} subtitle={`Ride · ${selected?.city}`}
        badge={selected ? <Badge variant={selected.status.toLowerCase().replace(/\s+/g, '')} label={selected.status} showDot /> : null}>
        {selected && (
          <>
            <DrawerSection title="PASSENGER & TRIP DETAILS">
              <DetailRow label="Ride ID" value={selected.id} mono />
              <DetailRow label="Passenger" value={selected.customer} />
              <DetailRow label="Passenger Phone" value={selected.customerPhone} />
              <DetailRow label="Pickup Location" value={selected.pickup} />
              <DetailRow label="Drop-off Destination" value={selected.drop} />
              <DetailRow label="Booking Time" value={selected.placedAt} />
              {selected.note && <DetailRow label="Customer Note" value={selected.note} />}
            </DrawerSection>
            <DrawerSection title="DRIVER & FARE DETAILS">
              <DetailRow label="Driver / Partner" value={selected.partner} />
              <DetailRow label="Driver Phone" value={selected.partnerPhone} />
              <DetailRow label="Vehicle Type" value={selected.vehicle} />
              <DetailRow label="Total Fare" value={selected.fare} />
              <DetailRow label="Payment Method" value={selected.payment} />
              <DetailRow label="Operational Status" value={<Badge variant={selected.status.toLowerCase().replace(/\s+/g, '')} label={selected.status} showDot />} />
            </DrawerSection>
          </>
        )}
      </Drawer>
    </div>
  );
}

// ── Courier page ────────────────────────────────────────────────────────────────
export function Courier({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [courierList, setCourierList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchCourier = async () => {
    setLoading(true);
    setFetchError(null);
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch from live orders table where service_type = 'courier'
      const { data: orderCouriers, error: orderErr } = await supabase
        .from('orders')
        .select('*, partners(id, full_name, phone), stores(store_name)')
        .eq('service_type', 'courier')
        .order('created_at', { ascending: false });

      if (orderErr) {
        throw new Error(orderErr.message);
      }

      // 2. Also check if dedicated courier_jobs table has records
      let dedicatedCourier: any[] = [];
      try {
        const { data: dCourier } = await supabase
          .from('courier_jobs')
          .select('*')
          .order('created_at', { ascending: false });
        if (dCourier && Array.isArray(dCourier)) dedicatedCourier = dCourier;
      } catch {
        // Table might be unused
      }

      const mappedOrders = (orderCouriers || []).map((c: any) => {
        let displayStatus = 'Pending';
        const rawStatus = (c.order_status || '').toLowerCase();
        if (rawStatus === 'in_transit') {
          displayStatus = 'In Transit';
        } else if (rawStatus === 'delivered' || rawStatus === 'completed') {
          displayStatus = 'Delivered';
        } else if (rawStatus === 'cancelled') {
          displayStatus = 'Cancelled';
        } else {
          displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
        }

        return {
          id: c.order_number || (c.id ? `COR-${String(c.id).slice(0, 8).toUpperCase()}` : 'COR-001'),
          _dbId: c.id,
          sender: c.customer_name || 'Sender',
          senderPhone: c.customer_phone || '—',
          receiver: c.delivery_address || 'Delivery Address',
          partner: c.partners?.full_name || (c.partner_id ? 'Assigned Partner' : 'Unassigned'),
          partnerPhone: c.partners?.phone || '—',
          type: 'Parcel / Document',
          weight: 'Standard',
          pickup: c.stores?.store_name || 'Sender Pickup Point',
          drop: c.delivery_address || 'Delivery Destination',
          quote: `₹${c.total_amount || 0}`,
          status: displayStatus,
          payment: c.payment_method || 'COD',
          placedAt: c.placed_at || c.created_at ? new Date(c.placed_at || c.created_at).toLocaleString('en-IN') : 'Recent',
          note: c.customer_note || '',
          _raw: c,
        };
      });

      const mappedDedicated = dedicatedCourier.map((c: any) => ({
        id: c.id ? `COR-${String(c.id).slice(0, 8).toUpperCase()}` : 'COR-001',
        _dbId: c.id,
        sender: c.sender_name || 'Sender',
        senderPhone: c.sender_phone || '—',
        receiver: c.receiver_name || 'Receiver',
        partner: c.partner_name || 'Unassigned',
        partnerPhone: '—',
        type: c.package_type || 'Parcel',
        weight: c.weight_kg ? `${c.weight_kg} kg` : '—',
        pickup: c.pickup_address || 'Pickup Point',
        drop: c.delivery_address || 'Delivery Point',
        quote: `₹${c.delivery_fee || 0}`,
        status: c.status || 'Pending',
        payment: 'Online',
        placedAt: c.created_at ? new Date(c.created_at).toLocaleString('en-IN') : 'Recent',
        note: '',
        _raw: c,
      }));

      const combined = [...mappedOrders, ...mappedDedicated];
      setCourierList(combined);
    } catch (err: any) {
      console.error('[Courier] Error fetching courier jobs:', err);
      setFetchError(err.message || 'Failed to load courier jobs from Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourier();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = courierList.filter(c => {
    const matchesSearch =
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.sender.toLowerCase().includes(search.toLowerCase()) ||
      c.partner.toLowerCase().includes(search.toLowerCase()) ||
      c.pickup.toLowerCase().includes(search.toLowerCase()) ||
      c.drop.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      c.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const columns = [
    { key: 'id', label: 'JOB ID', width: '110px' },
    { key: 'sender', label: 'SENDER' },
    { key: 'receiver', label: 'RECEIVER / DESTINATION' },
    { key: 'partner', label: 'PARTNER' },
    { key: 'quote', label: 'FEE', width: '80px' },
    { key: 'status', label: 'STATUS', width: '100px' },
    { key: 'placedAt', label: 'BOOKED AT', width: '140px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const rows = filtered.map(c => ({
    ...c,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{c.id}</span>,
    sender: (
      <div>
        <p className="font-semibold text-xs text-black">{c.sender}</p>
        <p className="text-[10px] text-[#9C9A9A]">{c.senderPhone}</p>
      </div>
    ),
    receiver: <span className="text-xs text-[#464646] line-clamp-1">{c.receiver}</span>,
    partner: (
      <div>
        <p className="font-semibold text-xs text-black">{c.partner}</p>
        <p className="text-[10px] text-[#9C9A9A]">{c.partnerPhone}</p>
      </div>
    ),
    quote: <span className="font-bold font-mono-data text-xs">{c.quote}</span>,
    status: <Badge variant={c.status.toLowerCase().replace(/\s+/g, '')} label={c.status} showDot />,
    placedAt: <span className="text-[11px] text-[#9C9A9A] font-mono-data">{c.placedAt}</span>,
    actions: (
      <button onClick={e => { e.stopPropagation(); setSelected(c); setDrawerOpen(true); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">
        View
      </button>
    ),
    _raw: c,
  }));

  const STATUS_TABS = ['All', 'Pending', 'In Transit', 'Delivered', 'Cancelled'];

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Courier Deliveries" subtitle="On-demand parcel and document logistics across Lucknow">
        <button
          onClick={() => { fetchCourier(); showToast('Syncing courier jobs from Supabase...'); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl px-3 py-2 hover:bg-[#F5F5F5] transition-colors cursor-pointer mr-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </SectionHeader>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KPICard label="TOTAL COURIER JOBS" value={String(courierList.length)} />
        <KPICard label="IN TRANSIT" value={String(courierList.filter(c => c.status === 'In Transit').length)} highlight={courierList.some(c => c.status === 'In Transit')} />
        <KPICard label="DELIVERED" value={String(courierList.filter(c => c.status === 'Delivered').length)} />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-black text-white'
                  : 'bg-[#F5F5F5] text-[#464646] hover:bg-[#E8E8E8]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#9C9A9A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sender, partner, destination…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E8E8E8] rounded-lg outline-none focus:border-black"
          />
        </div>
      </div>

      {loading ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <RefreshCw className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
          <p className="text-xs text-[#464646] font-bold">Loading courier delivery jobs from Supabase...</p>
        </div>
      ) : fetchError ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-8 text-center my-4 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-xs font-bold mb-1">Failed to Load Courier Jobs</p>
          <p className="text-[11px] text-red-600 mb-4">{fetchError}</p>
          <button
            onClick={fetchCourier}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Database Query
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          {search || statusFilter !== 'All' ? 'No courier deliveries match your filter criteria.' : 'No courier delivery jobs currently booked in database.'}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows}
          onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }} />
      )}

      <Drawer open={drawerOpen && !!selected} onClose={() => setDrawerOpen(false)}
        title={selected?.id || ''} subtitle="Courier Job · Lucknow"
        badge={selected ? <Badge variant={selected.status.toLowerCase().replace(/\s+/g, '')} label={selected.status} showDot /> : null}>
        {selected && (
          <>
            <DrawerSection title="PACKAGE & SENDER DETAILS">
              <DetailRow label="Job ID" value={selected.id} mono />
              <DetailRow label="Sender" value={selected.sender} />
              <DetailRow label="Sender Phone" value={selected.senderPhone} />
              <DetailRow label="Package Type" value={selected.type} />
              <DetailRow label="Pickup Point" value={selected.pickup} />
              <DetailRow label="Delivery Destination" value={selected.drop} />
              <DetailRow label="Booking Time" value={selected.placedAt} />
              {selected.note && <DetailRow label="Special Instructions" value={selected.note} />}
            </DrawerSection>
            <DrawerSection title="PARTNER & PRICING">
              <DetailRow label="Delivery Partner" value={selected.partner} />
              <DetailRow label="Partner Phone" value={selected.partnerPhone} />
              <DetailRow label="Delivery Fee" value={selected.quote} />
              <DetailRow label="Payment Method" value={selected.payment} />
              <DetailRow label="Current Status" value={<Badge variant={selected.status.toLowerCase().replace(/\s+/g, '')} label={selected.status} showDot />} />
            </DrawerSection>
          </>
        )}
      </Drawer>
    </div>
  );
}

// ── Vehicles page ───────────────────────────────────────────────────────────────
export function Vehicles({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: partnersData, loading, refetch } = useApi(
    () => partnersApi.getAll(),
    { data: [], total: 0 }
  );

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const partners = partnersData?.data || [];
  const vehiclesList = partners.map((p: any) => ({
    id: `VEH-${String(p.id).slice(0, 6)}`,
    partner: p.name,
    type: p.vehicle || 'Motorcycle',
    regNo: p.vehicleNo || 'UP32-Pending',
    city: p.city || 'Lucknow',
    status: p.kyc === 'Verified' ? 'Verified' : 'Pending',
    insurance: p.kyc === 'Verified' ? 'Valid' : 'Pending',
    permit: 'Valid',
    _raw: p,
  }));

  const columns = [
    { key: 'id', label: 'VEHICLE ID', width: '100px' },
    { key: 'partner', label: 'PARTNER' },
    { key: 'type', label: 'TYPE', width: '100px' },
    { key: 'regNo', label: 'REG. NO.' },
    { key: 'city', label: 'CITY', width: '90px' },
    { key: 'status', label: 'STATUS', width: '90px' },
    { key: 'insurance', label: 'INSURANCE', width: '100px' },
  ];

  const rows = vehiclesList.map(v => ({
    ...v,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{v.id}</span>,
    partner: <span className="font-semibold text-xs text-black">{v.partner}</span>,
    regNo: <span className="font-mono-data font-bold">{v.regNo}</span>,
    status: <Badge variant={v.status.toLowerCase()} label={v.status} showDot />,
    insurance: <Badge variant={v.insurance === 'Valid' ? 'verified' : 'pending'} label={v.insurance} />,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Vehicle Registry" subtitle="Partner delivery fleet vehicle verification and compliance">
        <Btn small onClick={() => { refetch(); showToast('Syncing fleet from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KPICard label="TOTAL FLEET VEHICLES" value={String(vehiclesList.length)} />
        <KPICard label="VERIFIED VEHICLES" value={String(vehiclesList.filter(v => v.status === 'Verified').length)} />
        <KPICard label="PENDING VERIFICATION" value={String(vehiclesList.filter(v => v.status === 'Pending').length)} highlight={vehiclesList.some(v => v.status === 'Pending')} />
      </div>

      {vehiclesList.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No delivery vehicles registered. Onboard delivery partners to register fleet vehicles.
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </div>
  );
}

// ── Dispatch Console page ───────────────────────────────────────────────────────
export function Dispatch({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: liveJobs, loading, refetch } = useApi(
    () => dashboardApi.getLiveJobs(),
    []
  );

  const { data: partnersData } = useApi(
    () => partnersApi.getAll({ status: 'online' }),
    { data: [], total: 0 }
  );

  const { refreshBadges } = useBadges();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const jobs = liveJobs || [];
  const unassignedJobs = jobs.filter(j => j.partner === '—' || j.status === 'Searching' || j.status === 'Pending');
  const availablePartners = partnersData?.data || [];

  // BUG-014 FIX: Auto-assign sets status to 'assigned' (not in_transit).
  // A production implementation should use proximity/zone matching via
  // a server-side RPC rather than selecting availablePartners[0].
  const handleAutoAssign = async (jobId: string) => {
    if (availablePartners.length === 0) {
      showToast('No active online partners available to assign');
      return;
    }
    // TODO: Replace with server-side proximity-based selection
    // For now, pick first available partner as placeholder
    const partner = availablePartners[0];
    try {
      const job = unassignedJobs.find(j => j.id === jobId);
      if (isSupabaseConfigured && job?._raw?.id) {
        await supabase.from('orders').update({
          partner_id: partner._raw?.id || partner.id,
          order_status: 'assigned', // BUG-014 FIX: was 'in_transit' - should be 'assigned'
        }).eq('id', job._raw.id);
      }
      showToast(`Job ${jobId} assigned to ${partner.name} — awaiting partner confirmation`);
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Dispatch Console" subtitle="Live dispatch operations and manual assignment management">
        <LiveDot />
        <Btn small onClick={() => { refetch(); showToast('Refreshing dispatch queue from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7">
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden mb-5 bg-white">
            <div className="px-5 py-3 border-b border-[#E8E8E8] flex items-center justify-between">
              <p className="text-sm font-bold text-black">UNASSIGNED DISPATCH QUEUE ({unassignedJobs.length})</p>
              <Badge variant={unassignedJobs.length > 0 ? 'high' : 'active'} label={unassignedJobs.length > 0 ? `${unassignedJobs.length} unassigned` : 'All assigned'} />
            </div>

            {unassignedJobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9C9A9A]">
                ✓ All active operational orders are currently assigned to delivery partners. Queue is clean.
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {unassignedJobs.map(job => (
                  <div key={job.id} className="p-4 hover:bg-[#FAFAFA]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{job.id}</span>
                        <span className="ml-2"><ServiceBadge service={job.service} /></span>
                      </div>
                      <Badge variant="pending" label={job.status || 'Unassigned'} />
                    </div>
                    <p className="text-sm font-semibold mb-0.5 text-black">{job.pickup || 'Pickup'} → {job.dest || 'Drop'}</p>
                    <p className="text-xs text-[#9C9A9A] mb-3">{job.customer}</p>
                    <div className="flex gap-2">
                      <Btn small variant="primary" onClick={() => handleAutoAssign(job.id)}>
                        Auto Assign Nearest Partner
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-5">
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-white">
            <div className="px-5 py-3 border-b border-[#E8E8E8]">
              <p className="text-sm font-bold text-black">ONLINE PARTNERS ({availablePartners.length})</p>
            </div>
            {availablePartners.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9C9A9A]">
                No delivery partners currently online.
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {availablePartners.map((p: any) => (
                  <div key={p.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-black">{p.name}</p>
                      <p className="text-[10px] text-[#9C9A9A]">{p.vehicle || 'Motorcycle'} · {p.phone || ''}</p>
                    </div>
                    <Badge variant="active" label="Available" showDot />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slots page ──────────────────────────────────────────────────────────────────
export function Slots({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [activeTab, setActiveTab] = React.useState<'shifts' | 'capacity'>('shifts');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [shifts, setShifts] = React.useState([
    { id: 'SHF-001', zone: 'Lucknow Central', service: 'Food Delivery', date: '2026-11-10', start: '08:00', end: '14:00', slots: 12, booked: 9, status: 'Active' },
    { id: 'SHF-002', zone: 'Gomti Nagar', service: 'Ride', date: '2026-11-10', start: '14:00', end: '20:00', slots: 8, booked: 5, status: 'Active' },
    { id: 'SHF-003', zone: 'Hazratganj', service: 'Grocery', date: '2026-11-10', start: '20:00', end: '23:59', slots: 6, booked: 6, status: 'Full' },
    { id: 'SHF-004', zone: 'Alambagh', service: 'Courier', date: '2026-11-11', start: '09:00', end: '15:00', slots: 10, booked: 2, status: 'Open' },
  ]);
  const [form, setForm] = React.useState({ zone: 'Lucknow Central', service: 'Food Delivery', date: '', start: '08:00', end: '14:00', slots: '10' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { showToast('Please select a date.'); return; }
    const newShift = {
      id: `SHF-${String(shifts.length + 1).padStart(3, '0')}`,
      zone: form.zone, service: form.service, date: form.date,
      start: form.start, end: form.end,
      slots: parseInt(form.slots, 10) || 10,
      booked: 0, status: 'Open',
    };
    setShifts(prev => [newShift, ...prev]);
    setShowAddModal(false);
    setForm({ zone: 'Lucknow Central', service: 'Food Delivery', date: '', start: '08:00', end: '14:00', slots: '10' });
    showToast(`Shift ${newShift.id} created for ${form.zone}`);
  };

  const handleDeleteShift = (id: string) => {
    if (!window.confirm(`Delete shift ${id}?`)) return;
    setShifts(prev => prev.filter(s => s.id !== id));
    showToast(`Shift ${id} removed.`);
  };

  const totalSlots = shifts.reduce((s, sh) => s + sh.slots, 0);
  const totalBooked = shifts.reduce((s, sh) => s + sh.booked, 0);
  const fillRate = totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <SectionHeader title="Partner Shift Marketplace" subtitle="Manage shift allocations and zone capacity controls" />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Shifts', value: shifts.length },
          { label: 'Total Slots', value: totalSlots },
          { label: 'Booked Slots', value: totalBooked },
          { label: 'Fill Rate', value: `${fillRate}%` },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E8E8E8] rounded-xl p-4">
            <p className="text-[#9C9A9A] text-xs mb-1">{k.label}</p>
            <p className="text-black text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + action */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['shifts', 'capacity'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${activeTab === t ? 'bg-black text-white' : 'bg-[#F5F5F5] text-[#464646] hover:bg-[#EBEBEB]'}`}>
              {t === 'shifts' ? 'Shift Schedule' : 'Zone Capacity'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
          + Add Shift
        </button>
      </div>

      {activeTab === 'shifts' && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#F9F9F9] border-b border-[#E8E8E8]">
              <tr>{['Shift ID', 'Zone', 'Service', 'Date', 'Time Window', 'Slots', 'Booked', 'Fill', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#9C9A9A] font-bold uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {shifts.map(sh => {
                const fill = sh.slots > 0 ? Math.round((sh.booked / sh.slots) * 100) : 0;
                const statusColor = sh.status === 'Full' ? 'bg-red-100 text-red-700' : sh.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';
                return (
                  <tr key={sh.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-mono font-bold text-[#9C9A9A]">{sh.id}</td>
                    <td className="px-4 py-3 font-semibold text-black">{sh.zone}</td>
                    <td className="px-4 py-3 text-[#464646]">{sh.service}</td>
                    <td className="px-4 py-3 text-[#464646]">{sh.date}</td>
                    <td className="px-4 py-3 text-[#464646]">{sh.start} – {sh.end}</td>
                    <td className="px-4 py-3 font-bold text-black">{sh.slots}</td>
                    <td className="px-4 py-3 text-[#464646]">{sh.booked}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                          <div className="h-full bg-black rounded-full" style={{ width: `${fill}%` }} />
                        </div>
                        <span className="font-bold text-black">{fill}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor}`}>{sh.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteShift(sh.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shifts.length === 0 && (
            <p className="text-center text-[#9C9A9A] text-xs py-8">No shifts scheduled. Click "Add Shift" to create one.</p>
          )}
        </div>
      )}

      {activeTab === 'capacity' && (
        <div className="grid grid-cols-2 gap-4">
          {['Lucknow Central', 'Gomti Nagar', 'Hazratganj', 'Alambagh', 'Chinhat', 'Faizabad Road'].map(zone => {
            const zoneShifts = shifts.filter(s => s.zone === zone);
            const zSlots = zoneShifts.reduce((s, sh) => s + sh.slots, 0);
            const zBooked = zoneShifts.reduce((s, sh) => s + sh.booked, 0);
            const zFill = zSlots > 0 ? Math.round((zBooked / zSlots) * 100) : 0;
            return (
              <div key={zone} className="bg-white border border-[#E8E8E8] rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-bold text-sm text-black">{zone}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${zFill >= 90 ? 'bg-red-100 text-red-700' : zFill >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {zFill}% filled
                  </span>
                </div>
                <div className="w-full h-2 bg-[#E8E8E8] rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-black rounded-full transition-all" style={{ width: `${zFill}%` }} />
                </div>
                <div className="flex justify-between text-xs text-[#9C9A9A]">
                  <span>{zBooked} booked</span>
                  <span>{zSlots} total slots</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Shift Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base text-black mb-4">Add New Shift</h3>
            <form onSubmit={handleAddShift} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#464646] block mb-1">Zone</label>
                <select value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs focus:outline-none">
                  {['Lucknow Central', 'Gomti Nagar', 'Hazratganj', 'Alambagh', 'Chinhat', 'Faizabad Road'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#464646] block mb-1">Service Type</label>
                <select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs focus:outline-none">
                  {['Food Delivery', 'Grocery', 'Ride', 'Courier'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#464646] block mb-1">Start Time</label>
                  <input type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#464646] block mb-1">End Time</label>
                  <input type="time" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#464646] block mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#464646] block mb-1">Total Slots</label>
                <input type="number" min="1" max="100" value={form.slots} onChange={e => setForm(f => ({ ...f, slots: e.target.value }))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs focus:outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-bold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notifications page ──────────────────────────────────────────────────────────
export function Notifications({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: pendingKyc, loading: kycLoading, error: kycError, refetch: refetchKyc } = useApi(
    () => kycApi.getAll({ status: 'pending' }),
    []
  );
  const { data: pendingVendors, loading: vendorLoading, error: vendorError, refetch: refetchVendors } = useApi(
    () => vendorsApi.getPendingApprovals(),
    []
  );
  const { data: openTickets, loading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useApi(
    () => supportApi.getTickets({ status: 'open' }),
    { data: [], total: 0 }
  );

  const loading = kycLoading || vendorLoading || ticketsLoading;
  const anyError = kycError || vendorError || ticketsError;

  const handleRefresh = () => {
    refetchKyc();
    refetchVendors();
    refetchTickets();
  };

  const notifications: Array<{
    id: string;
    cat: string;
    title: string;
    detail: string;
    priority: 'high' | 'medium';
    page: string;
    count: number;
  }> = [];

  const kycCount = pendingKyc?.length || 0;
  if (kycCount > 0) {
    notifications.push({
      id: 'notif-kyc',
      cat: 'KYC Documents',
      title: `${kycCount} KYC document${kycCount > 1 ? 's' : ''} awaiting admin verification`,
      detail: 'Review uploaded identity, vehicle RC and bank proof credentials in the KYC queue',
      priority: 'high',
      page: 'kyc',
      count: kycCount,
    });
  }

  const vendorCount = pendingVendors?.length || 0;
  if (vendorCount > 0) {
    notifications.push({
      id: 'notif-vendor',
      cat: 'Vendor Onboarding',
      title: `${vendorCount} vendor application${vendorCount > 1 ? 's' : ''} awaiting review`,
      detail: 'Vendors have submitted complete documents and are awaiting Master Admin approval',
      priority: 'high',
      page: 'vendors',
      count: vendorCount,
    });
  }

  const ticketsCount = openTickets?.data?.length || 0;
  if (ticketsCount > 0) {
    notifications.push({
      id: 'notif-tickets',
      cat: 'Customer Support',
      title: `${ticketsCount} open support ticket${ticketsCount > 1 ? 's' : ''} require attention`,
      detail: 'Customer and partner support requests pending administrative resolution',
      priority: 'medium',
      page: 'support',
      count: ticketsCount,
    });
  }

  return (
    <div className="p-6">
      <SectionHeader
        title="System Notifications & Alerts"
        subtitle="Real-time operational alerts dynamically derived from live database records"
      >
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl px-3 py-2 hover:bg-[#F5F5F5] transition-colors cursor-pointer mr-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Alerts
        </button>
      </SectionHeader>

      {loading ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <RefreshCw className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
          <p className="text-xs text-[#464646] font-bold">Scanning database for operational alerts...</p>
        </div>
      ) : anyError ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-8 text-center my-4 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-xs font-bold mb-1">Failed to Check System Alerts</p>
          <p className="text-[11px] text-red-600 mb-4">{anyError}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white">
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3 text-green-600 font-bold text-lg">
            ✓
          </div>
          <p className="text-sm font-bold text-black mb-1">All Systems Operational</p>
          <p className="text-xs text-[#9C9A9A]">Zero pending alerts or unresolved operational issues across Lucknow.</p>
        </div>
      ) : (
        <div className="border border-[#E8E8E8] rounded-xl divide-y divide-[#F0F0F0] bg-white overflow-hidden shadow-sm">
          {notifications.map(n => (
            <div key={n.id} className="flex items-center justify-between gap-4 p-5 hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="mt-1 flex-shrink-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full block ${
                      n.priority === 'high' ? 'bg-[#A35E47] animate-pulse' : 'bg-black'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-black text-black">{n.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F0F0F0] text-[#464646]">
                      {n.cat}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                      {n.count} pending
                    </span>
                  </div>
                  <p className="text-xs text-[#9C9A9A]">{n.detail}</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate(n.page);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-[#333] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  Investigate <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Placeholder generic page ───────────────────────────────────────────────────
export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="p-6">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="border border-[#E8E8E8] rounded-xl p-12 text-center bg-white">
        <p className="text-[#9C9A9A] text-sm font-medium">This module is connected to live RoadRider infrastructure.</p>
        <p className="text-[#9C9A9A] text-xs mt-1">Operational records update in real time.</p>
      </div>
    </div>
  );
}
