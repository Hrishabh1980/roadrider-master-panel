import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Timeline, Btn, Tabs, StatGroup } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { customersApi } from '../services/api';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { Plus, Download, Check, X, UserPlus, PhoneCall, Wallet, RefreshCw } from 'lucide-react';

const TABS = ['Overview', 'Orders', 'Payments', 'Wallet'];

export default function Customers({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: apiResponse, loading, refetch } = useApi(
    () => customersApi.getAll(),
    { data: [], total: 0, page: 1 }
  );

  const [customersList, setCustomersList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerTxns, setCustomerTxns] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (apiResponse?.data) {
      setCustomersList(apiResponse.data);
    }
  }, [apiResponse]);

  useEffect(() => {
    if (selected?._raw?.id && isSupabaseConfigured) {
      setLoadingDetails(true);
      Promise.all([
        supabase.from('orders').select('*').or(`customer_id.eq.${selected._raw.id},customer_name.eq.${selected.name}`).order('created_at', { ascending: false }).limit(10),
        supabase.from('transactions').select('*').eq('entity_id', selected._raw.id).order('created_at', { ascending: false }).limit(10),
      ]).then(([ordersRes, txnsRes]) => {
        setCustomerOrders(ordersRes.data || []);
        setCustomerTxns(txnsRes.data || []);
      }).finally(() => setLoadingDetails(false));
    } else {
      setCustomerOrders([]);
      setCustomerTxns([]);
    }
  }, [selected]);

  // Add customer form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [email, setEmail] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (isSupabaseConfigured) {
        const { data: newRow, error } = await supabase.from('customers').insert({
          full_name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          city: 'Lucknow',
          status: 'Active',
          risk_level: 'Low',
        }).select().single();

        if (error) {
          showToast(`Failed to add customer: ${error.message}`);
          return;
        }
      }
      refetch();
      setAddModalOpen(false);
      setName('');
      setPhone('+91 ');
      setEmail('');
      showToast(`Customer ${name.trim()} added successfully`);
    } catch (err: any) {
      showToast(`Error adding customer: ${err.message}`);
    }
  };

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      ['ID,Name,Phone,Email,City,Orders,Trips,LTV,Wallet,Status,Risk,Joined'].join(',') + '\n' +
      customersList.map(c => `${c.id},"${c.name}",${c.phone},${c.email},${c.city},${c.orders},${c.trips},${c.ltv},${c.wallet},${c.status},${c.risk},${c.joined}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'roadrider_customers_lucknow.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Customer directory exported to CSV');
  };

  const handleToggleSuspend = (id: string) => {
    setCustomersList(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus = c.status === 'Active' ? 'Suspended' : 'Active';
        showToast(`Customer ${c.name} account is now ${nextStatus}`);
        return { ...c, status: nextStatus };
      }
      return c;
    }));
    if (selected && selected.id === id) {
      setSelected((prev: any) => ({ ...prev, status: prev.status === 'Active' ? 'Suspended' : 'Active' }));
    }
  };

  const columns = [
    { key: 'id', label: 'CUSTOMER ID', width: '110px' },
    { key: 'name', label: 'NAME' },
    { key: 'phone', label: 'MOBILE' },
    { key: 'city', label: 'CITY' },
    { key: 'orders', label: 'ORDERS', width: '70px' },
    { key: 'trips', label: 'TRIPS', width: '60px' },
    { key: 'ltv', label: 'LTV' },
    { key: 'wallet', label: 'WALLET' },
    { key: 'status', label: 'STATUS', width: '90px' },
    { key: 'risk', label: 'RISK', width: '70px' },
    { key: 'joined', label: 'JOINED' },
    { key: 'actions', label: '', width: '80px' },
  ];

  const rows = customersList.map(c => ({
    ...c,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{c.id}</span>,
    name: <span className="font-semibold text-black">{c.name}</span>,
    phone: <span className="text-xs font-mono-data">{c.phone}</span>,
    orders: <span className="font-bold font-mono-data">{c.orders}</span>,
    trips: <span className="font-bold font-mono-data">{c.trips}</span>,
    ltv: <span className="font-bold font-mono-data">{c.ltv}</span>,
    wallet: <span className="font-mono-data">{c.wallet}</span>,
    status: <Badge variant={c.status.toLowerCase()} label={c.status} showDot />,
    risk: <Badge variant={c.risk.toLowerCase()} label={c.risk} />,
    actions: (
      <button onClick={(e) => { e.stopPropagation(); setSelected(c); setDrawerOpen(true); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">View</button>
    ),
    _raw: c,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Customers" subtitle={`${customersList.length} total registered in Lucknow · ${customersList.filter(c => c.status === 'Active').length} active`}>
        <Btn small onClick={() => { refetch(); showToast('Syncing with Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn small onClick={() => setAddModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Customer
        </Btn>
        <Btn variant="primary" small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-5 gap-4 mb-5">
        {[
          { label: 'TOTAL CUSTOMERS', value: String(customersList.length) },
          { label: 'ACTIVE (30D)', value: String(customersList.filter(c => c.status === 'Active').length) },
          { label: 'NEW THIS MONTH', value: '284' },
          { label: 'AVG ORDER VALUE', value: '₹342' },
          { label: 'HIGH RISK', value: String(customersList.filter(c => c.risk === 'High').length), highlight: true },
        ].map(s => (
          <div key={s.label} className="border border-[#E8E8E8] rounded-xl p-3 bg-white">
            <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>{s.label}</p>
            <p className={`text-xl font-black font-mono-data ${(s as any).highlight ? 'text-[#A35E47]' : 'text-black'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <FilterBar
        filters={[
          { label: 'City', options: ['Lucknow'] },
          { label: 'Status', options: ['Active', 'Suspended', 'Inactive'] },
          { label: 'Risk', options: ['Low', 'Medium', 'High'] },
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
        title={selected?.name || ''}
        subtitle={`${selected?.id} · ${selected?.phone} · Lucknow`}
        badge={selected ? (
          <div className="flex gap-1.5">
            <Badge variant={selected.status.toLowerCase()} label={selected.status} showDot />
            <Badge variant={selected.risk.toLowerCase()} label={`${selected.risk} Risk`} />
          </div>
        ) : null}
      >
        {selected && (
          <>
            <Tabs tabs={TABS} active={tab} onChange={setTab} />

            {tab === 'Overview' && (
              <>
                <DrawerSection title="PROFILE">
                  <DetailRow label="Customer ID" value={selected.id} mono />
                  <DetailRow label="Name" value={selected.name} />
                  <DetailRow label="Mobile" value={selected.phone} mono />
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="City" value={selected.city} />
                  <DetailRow label="Joined" value={selected.joined} />
                </DrawerSection>

                <DrawerSection title="METRICS">
                  <StatGroup items={[
                    { label: 'Total Orders', value: String(selected.orders) },
                    { label: 'Total Trips', value: String(selected.trips) },
                    { label: 'Lifetime Value', value: selected.ltv, highlight: true },
                    { label: 'Wallet Balance', value: selected.wallet },
                  ]} />
                </DrawerSection>

                <DrawerSection title="ACTIONS">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => showToast(`Initiated SMS verification call to ${selected.phone}`)}
                      className="py-2.5 border border-[#E8E8E8] hover:bg-[#F5F5F5] text-xs font-bold rounded-xl"
                    >
                      Contact User
                    </button>
                    <button
                      onClick={() => {
                        if (onNavigate) onNavigate('refunds');
                        setDrawerOpen(false);
                      }}
                      className="py-2.5 border border-[#E8E8E8] hover:bg-[#F5F5F5] text-xs font-bold rounded-xl"
                    >
                      Issue Refund →
                    </button>
                    <button
                      onClick={() => {
                        const amt = prompt('Enter wallet credit amount in INR:', '100');
                        if (amt) {
                          setSelected((prev: any) => ({ ...prev, wallet: `₹${(parseInt(prev.wallet.replace('₹', '')) || 0) + parseInt(amt)}` }));
                          showToast(`Added ₹${amt} promotional credit to ${selected.name}'s wallet`);
                        }
                      }}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                    >
                      + Add Wallet Credit
                    </button>
                    <button
                      onClick={() => handleToggleSuspend(selected.id)}
                      className={`py-2.5 text-xs font-bold rounded-xl text-white ${selected.status === 'Active' ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-[#333]'}`}
                    >
                      {selected.status === 'Active' ? 'Suspend Account' : 'Restore Account'}
                    </button>
                  </div>
                </DrawerSection>
              </>
            )}

            {tab === 'Orders' && (
              <div className="space-y-2">
                {loadingDetails ? (
                  <div className="py-8 text-center text-xs text-[#9C9A9A]">Loading customer orders...</div>
                ) : customerOrders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9C9A9A]">No orders recorded for this customer yet.</div>
                ) : (
                  customerOrders.map(o => (
                    <div key={o.id} className="border border-[#E8E8E8] rounded-xl p-3 bg-[#FAFAFA]">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold font-mono-data text-[#9C9A9A]">{o.order_number || o.id?.slice(0, 8)}</span>
                        <Badge variant={o.status?.toLowerCase().replace(/\s+/g, '') || 'pending'} label={o.status || 'Pending'} showDot />
                      </div>
                      <p className="text-xs font-semibold text-black">{o.customer_name || selected.name}</p>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-[#9C9A9A]">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</span>
                        <span className="text-xs font-bold font-mono-data">₹{Number(o.total_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'Payments' && (
              <div className="space-y-2">
                {loadingDetails ? (
                  <div className="py-8 text-center text-xs text-[#9C9A9A]">Loading transactions...</div>
                ) : customerTxns.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9C9A9A]">No transaction records found for this customer.</div>
                ) : (
                  customerTxns.map(t => (
                    <div key={t.id} className="border border-[#E8E8E8] rounded-xl p-3 bg-[#FAFAFA]">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold font-mono-data text-[#9C9A9A]">{t.transaction_id || t.id?.slice(0, 8)}</span>
                        <Badge variant={t.status?.toLowerCase() || 'pending'} label={t.status || 'Pending'} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-[#464646]">{t.type || 'Payment'} · {t.payment_method || t.method || 'Online'}</span>
                        <span className="text-xs font-bold font-mono-data">₹{Number(t.amount || 0).toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-[#9C9A9A] mt-0.5">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'Wallet' && (
              <DrawerSection title="WALLET SUMMARY">
                <DetailRow label="Current Balance" value={selected.wallet || '₹0'} />
                <DetailRow label="Total Orders" value={String(customerOrders.length || selected.orders || 0)} />
                <DetailRow label="Recent Transactions" value={String(customerTxns.length)} />
                <DetailRow label="Wallet Status" value={<Badge variant={selected.status === 'Active' ? 'active' : 'inactive'} label={selected.status === 'Active' ? 'Active' : 'Restricted'} showDot />} />
              </DrawerSection>
            )}
          </>
        )}
      </Drawer>

      {/* Add Customer Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Register New Customer</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Full Name *</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Neha Verma"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Mobile Number *</label>
                <input
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="neha@example.com"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
