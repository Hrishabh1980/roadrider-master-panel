import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, ServiceBadge, FilterBar, Btn, Tabs, KPICard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { promotionsApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Plus, Check, X, Download, Tag, Edit, Sparkles, RefreshCw } from 'lucide-react';

export default function Promotions({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [tab, setTab] = useState('Overview');
  const [promotionsList, setPromotionsList] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editPromo, setEditPromo] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // New promo form state
  const [code, setCode] = useState('');
  const [service, setService] = useState('All');
  const [audience, setAudience] = useState('All Users');
  const [discount, setDiscount] = useState('20% off');
  const [minOrder, setMinOrder] = useState('199');
  const [maxDiscount, setMaxDiscount] = useState('100');

  const { data: dbPromos, loading, refetch } = useApi(
    () => promotionsApi.getAll(),
    []
  );

  useEffect(() => {
    if (dbPromos) {
      setPromotionsList(dbPromos.map((p: any) => ({
        id: p.id ? `PRO-${String(p.id).slice(0, 6).toUpperCase()}` : 'PRO-001',
        _dbId: p.id,
        code: p.code || 'PROMO',
        service: p.service_type || 'All',
        audience: p.target_audience || 'All Users',
        discount: p.discount_value ? `${p.discount_value}% off` : 'Discount',
        minOrder: `₹${p.min_order_amount ?? 0}`,
        maxDiscount: `₹${p.max_discount_amount ?? 100}`,
        used: String(p.times_used ?? 0),
        limit: String(p.usage_limit ?? 'Unlimited'),
        end: p.valid_until ? new Date(p.valid_until).toLocaleDateString() : 'Ongoing',
        status: p.is_active ? 'Active' : 'Expired',
        revenue: '₹0',
        _raw: p,
      })));
    }
  }, [dbPromos]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = ['Overview', 'Coupons'];

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    if (isSupabaseConfigured) {
      try {
        // BUG-009 FIX: Column names aligned with supabase_schema.sql
        const { error } = await supabase.from('promotions').insert({
          code: code.trim().toUpperCase(),
          service: 'All',
          discount: `${parseInt(discount) || 20}% OFF`,
          min_order: Number(minOrder) || 0,
          max_discount: Number(maxDiscount) || 100,
          status: 'Active',
        });

        if (error) {
          showToast(`Error creating coupon: ${error.message}`);
          return;
        }

        showToast(`Coupon ${code.trim().toUpperCase()} launched successfully!`);
        setShowCreate(false);
        setCode('');
        refetch();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      ['ID,Code,Service,Discount,MinOrder,Used,Status'].join(',') + '\n' +
      promotionsList.map(p => `${p.id},${p.code},${p.service},${p.discount},${p.minOrder},${p.used},${p.status}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'roadrider_promotions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Promotions exported to CSV');
  };

  const columns = [
    { key: 'id', label: 'ID', width: '90px' },
    { key: 'code', label: 'CODE' },
    { key: 'service', label: 'SERVICE', width: '90px' },
    { key: 'discount', label: 'DISCOUNT' },
    { key: 'minOrder', label: 'MIN ORDER' },
    { key: 'maxDiscount', label: 'MAX DISC' },
    { key: 'used', label: 'USED', width: '70px' },
    { key: 'limit', label: 'LIMIT', width: '70px' },
    { key: 'end', label: 'EXPIRES' },
    { key: 'status', label: 'STATUS', width: '100px' },
  ];

  const rows = promotionsList.map(p => ({
    ...p,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{p.id}</span>,
    code: <span className="font-mono-data font-black tracking-wider text-black">{p.code}</span>,
    service: p.service === 'All' ? <Badge variant="active" label="All Services" /> : <ServiceBadge service={p.service} />,
    discount: <span className="font-bold">{p.discount}</span>,
    used: <span className="font-bold font-mono-data">{p.used}</span>,
    status: (
      <Badge variant={p.status === 'Active' ? 'active' : 'inactive'} label={p.status} showDot />
    ),
  }));

  const activePromos = promotionsList.filter(p => p.status === 'Active');

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Promotions & Campaigns" subtitle="Manage marketing vouchers and promotional discounts">
        <Btn small onClick={() => { refetch(); showToast('Syncing promotions from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn small onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Create Coupon
        </Btn>
        <Btn variant="primary" small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KPICard label="ACTIVE PROMOTIONS" value={String(activePromos.length)} />
            <KPICard label="TOTAL CAMPAIGNS" value={String(promotionsList.length)} />
            <KPICard label="PLATFORM STATUS" value="Promotions Engine Online" />
          </div>

          {activePromos.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {activePromos.map(p => (
                <div key={p.id} className="border border-[#E8E8E8] rounded-xl p-5 bg-white hover:border-black transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xl font-black font-mono-data tracking-wider text-black">{p.code}</p>
                      <p className="text-xs text-[#9C9A9A] mt-0.5">{p.service}</p>
                    </div>
                    <Badge variant="active" label="Active" showDot />
                  </div>
                  <div className="text-2xl font-black text-[#A35E47] mb-3">{p.discount}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-[#9C9A9A]">Used</p><p className="font-bold">{p.used}</p></div>
                    <div><p className="text-[#9C9A9A]">Min Order</p><p className="font-bold">{p.minOrder}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {promotionsList.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No promotional coupons registered in database. Click <strong>+ Create Coupon</strong> to launch a campaign.
            </div>
          ) : (
            <DataTable columns={columns} rows={rows} />
          )}
        </>
      )}

      {tab === 'Coupons' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#9C9A9A]">All registered promotional vouchers in Supabase</p>
            <Btn small variant="primary" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Coupon
            </Btn>
          </div>
          {promotionsList.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No coupons recorded.
            </div>
          ) : (
            <DataTable columns={columns} rows={rows} />
          )}
        </>
      )}

      {/* Create Coupon Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Create Promotional Voucher</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Coupon Code *</label>
                <input
                  required
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME50"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none font-mono font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Discount %</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    placeholder="20"
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    value={minOrder}
                    onChange={e => setMinOrder(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Publish Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
