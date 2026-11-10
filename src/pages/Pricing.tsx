import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, Btn, Tabs, KPICard, AlertBanner } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { pricingApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Plus, Check, X, History, Sparkles, Sliders, RefreshCw } from 'lucide-react';

export default function Pricing() {
  const [activeTab, setActiveTab] = useState('Pricing Rules');
  const [rules, setRules] = useState<any[]>([]);
  const [surgeList, setSurgeList] = useState<any[]>([]);
  const [editRule, setEditRule] = useState<any | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form states for new pricing rule
  const [newService, setNewService] = useState('Food');
  const [newBaseFee, setNewBaseFee] = useState('25');
  const [newDistFee, setNewDistFee] = useState('8');
  const [newPlatformFee, setNewPlatformFee] = useState('10');
  const [newDelivFee, setNewDelivFee] = useState('40');
  const [newMinFare, setNewMinFare] = useState('49');
  const [newMaxFare, setNewMaxFare] = useState('500');

  // Surge rule form
  const [surgeService, setSurgeService] = useState('Food');
  const [surgeZone, setSurgeZone] = useState('Zone A - Gomti Nagar');
  const [surgeMultiplier, setSurgeMultiplier] = useState('1.5');
  const [surgeStart, setSurgeStart] = useState('18:00');
  const [surgeEnd, setSurgeEnd] = useState('21:00');

  const { data: dbRules, loading: loadingRules, refetch: refetchRules } = useApi(
    () => pricingApi.getRules(),
    []
  );

  const { data: dbSurge, loading: loadingSurge, refetch: refetchSurge } = useApi(
    () => pricingApi.getSurgeRules(),
    []
  );

  useEffect(() => {
    if (dbRules) {
      setRules(dbRules.map((r: any) => ({
        id: r.id ? `PRC-${String(r.id).slice(0, 6).toUpperCase()}` : 'PRC-001',
        _dbId: r.id,
        service: r.service_type ? r.service_type.charAt(0).toUpperCase() + r.service_type.slice(1) : 'Food',
        city: 'Lucknow',
        zone: 'All Zones',
        baseFee: `₹${r.base_fee ?? 0}`,
        distFee: `₹${r.distance_fee_per_km ?? 0}/km`,
        timeFee: `₹${r.time_fee_per_min ?? 0}/min`,
        platformFee: `${r.platform_fee_pct ?? 0}%`,
        delivFee: `₹${r.delivery_fee ?? 0}`,
        minFare: `₹${r.min_fare ?? 0}`,
        maxFare: r.max_fare ? `₹${r.max_fare}` : 'No limit',
        version: `v${r.version || 1}`,
        status: r.status === 'active' ? 'Active' : 'Inactive',
        _raw: r,
      })));
    }
  }, [dbRules]);

  useEffect(() => {
    if (dbSurge) {
      setSurgeList(dbSurge.map((s: any) => ({
        id: s.id ? `SRG-${String(s.id).slice(0, 6).toUpperCase()}` : 'SRG-001',
        _dbId: s.id,
        service: s.service_type || 'Food',
        zone: s.zone_name || 'Zone A',
        demand: s.demand_index ?? 50,
        supply: s.supply_index ?? 50,
        ratio: s.multiplier ? Number(s.multiplier) : 1.0,
        multiplier: `${s.multiplier || 1.0}x`,
        start: s.start_time || '18:00',
        end: s.end_time || '21:00',
        status: s.is_active ? 'Active' : 'Inactive',
        _raw: s,
      })));
    }
  }, [dbSurge]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = ['Pricing Rules', 'Surge Rules', 'Commission'];

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConfigured) {
      try {
        // BUG-009 FIX: Column names aligned with supabase_schema.sql
        const { error } = await supabase.from('pricing_rules').insert({
          service: newService.toLowerCase(),
          base_fee: Number(newBaseFee) || 0,
          dist_fee: `₹${Number(newDistFee) || 0}/km`,
          platform_fee: `${Number(newPlatformFee) || 0}%`,
          deliv_fee: Number(newDelivFee) || 0,
          min_fare: Number(newMinFare) || 0,
          max_fare: Number(newMaxFare) || null,
          status: 'Active',
          version: 'v1',
          city: 'Lucknow',
        });

        if (error) {
          showToast(`Error creating pricing rule: ${error.message}`);
          return;
        }

        showToast(`Pricing rule created for ${newService}`);
        setCreateModalOpen(false);
        refetchRules();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleCreateSurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConfigured) {
      try {
        // BUG-009 FIX: Column names aligned with supabase_schema.sql
        const { error } = await supabase.from('surge_rules').insert({
          service: surgeService.toLowerCase(),
          zone: surgeZone,
          multiplier: `${Number(surgeMultiplier) || 1.5}x`,
          start_time: surgeStart,
          end_time: surgeEnd,
          status: 'Active',
          ratio: Number(surgeMultiplier) || 1.5,
        });

        if (error) {
          showToast(`Error creating surge rule: ${error.message}`);
          return;
        }

        showToast(`Surge rule active for ${surgeZone}`);
        refetchSurge();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const pricingColumns = [
    { key: 'id', label: 'RULE ID', width: '100px' },
    { key: 'service', label: 'SERVICE', width: '90px' },
    { key: 'city', label: 'CITY' },
    { key: 'baseFee', label: 'BASE FEE' },
    { key: 'distFee', label: 'DISTANCE' },
    { key: 'platformFee', label: 'PLATFORM %' },
    { key: 'delivFee', label: 'DELIVERY FEE' },
    { key: 'minFare', label: 'MIN FARE' },
    { key: 'maxFare', label: 'MAX FARE' },
    { key: 'version', label: 'VERSION', width: '80px' },
    { key: 'status', label: 'STATUS', width: '90px' },
  ];

  const surgeColumns = [
    { key: 'id', label: 'RULE ID', width: '100px' },
    { key: 'zone', label: 'ZONE' },
    { key: 'service', label: 'SERVICE', width: '90px' },
    { key: 'multiplier', label: 'MULTIPLIER', width: '100px' },
    { key: 'start', label: 'START', width: '70px' },
    { key: 'end', label: 'END', width: '70px' },
    { key: 'status', label: 'STATUS', width: '90px' },
  ];

  const pricingRows = rules.map(r => ({
    ...r,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{r.id}</span>,
    service: <Badge variant={r.service.toLowerCase()} label={r.service} />,
    status: <Badge variant={r.status.toLowerCase()} label={r.status} showDot />,
  }));

  const surgeRows = surgeList.map(r => ({
    ...r,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{r.id}</span>,
    service: <Badge variant={r.service.toLowerCase()} label={r.service} />,
    multiplier: <span className="font-black font-mono-data text-sm text-[#A35E47]">{r.multiplier}</span>,
    status: <Badge variant={r.status.toLowerCase()} label={r.status} showDot />,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Pricing & Surge" subtitle="Manage dynamic pricing, municipal rate controls, and surge multipliers">
        <Btn small onClick={() => { refetchRules(); refetchSurge(); showToast('Refreshing pricing from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingRules ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn variant="primary" small onClick={() => setCreateModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Create Rule
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Pricing Rules' && (
        <>
          <AlertBanner type="info">All pricing rules are enforced during checkout calculations across Food, Grocery, Rides, and Courier.</AlertBanner>
          <div className="mt-4">
            {rules.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
                No pricing rules currently configured in database. Click <strong>+ Create Rule</strong> to set base fees, distance rates, and platform percentages.
              </div>
            ) : (
              <DataTable columns={pricingColumns} rows={pricingRows} />
            )}
          </div>
        </>
      )}

      {activeTab === 'Surge Rules' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <KPICard label="ACTIVE SURGE ZONES" value={String(surgeList.filter(s => s.status === 'Active').length)} />
            <KPICard label="CONFIGURED SURGE RULES" value={String(surgeList.length)} />
            <KPICard label="PRICING ENGINE" value="Real-time Dynamic" />
          </div>

          {surgeList.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8] mb-6">
              No surge rules currently active in database. Configure a peak-hour zone surge below.
            </div>
          ) : (
            <div className="mb-6">
              <DataTable columns={surgeColumns} rows={surgeRows} />
            </div>
          )}

          <form onSubmit={handleCreateSurge} className="border border-[#E8E8E8] rounded-xl p-5 bg-[#FAFAFA]">
            <p className="text-sm font-bold mb-4 text-black">CONFIGURE DYNAMIC SURGE RULE</p>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold block mb-1 text-[#464646]">Service</label>
                <select value={surgeService} onChange={e => setSurgeService(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E8E8] outline-none bg-white">
                  <option>Food</option><option>Grocery</option><option>Rides</option><option>Courier</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-[#464646]">Zone</label>
                <input value={surgeZone} onChange={e => setSurgeZone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E8E8] outline-none bg-white" placeholder="e.g. Zone A" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-[#464646]">Multiplier (e.g. 1.5)</label>
                <input value={surgeMultiplier} onChange={e => setSurgeMultiplier(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E8E8] outline-none bg-white" placeholder="1.5" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-[#464646]">Time Window</label>
                <div className="flex items-center gap-1">
                  <input value={surgeStart} onChange={e => setSurgeStart(e.target.value)}
                    className="w-1/2 px-2 py-2 text-xs rounded-xl border border-[#E8E8E8] outline-none bg-white" placeholder="18:00" />
                  <span className="text-xs text-[#9C9A9A]">-</span>
                  <input value={surgeEnd} onChange={e => setSurgeEnd(e.target.value)}
                    className="w-1/2 px-2 py-2 text-xs rounded-xl border border-[#E8E8E8] outline-none bg-white" placeholder="21:00" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] cursor-pointer">
                Activate Surge Rule
              </button>
            </div>
          </form>
        </>
      )}

      {activeTab === 'Commission' && (
        <div>
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden mb-5 bg-white">
            <table className="rr-table">
              <thead>
                <tr>
                  <th>ENTITY TYPE</th>
                  <th>STANDARD COMMISSION RATE</th>
                  <th>APPLICATION BASIS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { entity: 'Restaurant Vendor', rate: '15% – 18%', basis: 'Per completed order' },
                  { entity: 'Grocery Vendor', rate: '8% – 12%', basis: 'Per completed order' },
                  { entity: 'Ride Service Partner', rate: '15%', basis: 'Per completed trip fare' },
                  { entity: 'Courier Delivery Partner', rate: '12%', basis: 'Per completed package job' },
                ].map(c => (
                  <tr key={c.entity}>
                    <td className="font-semibold text-black">{c.entity}</td>
                    <td className="font-bold text-xs">{c.rate}</td>
                    <td className="text-xs text-[#9C9A9A]">{c.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Create Pricing Rule</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Service Type</label>
                <select
                  value={newService}
                  onChange={e => setNewService(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none bg-white"
                >
                  <option value="Food">Food Delivery</option>
                  <option value="Grocery">Grocery Delivery</option>
                  <option value="Rides">Passenger Rides</option>
                  <option value="Courier">Courier Package</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Base Fee (₹)</label>
                  <input
                    type="number"
                    value={newBaseFee}
                    onChange={e => setNewBaseFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Distance Fee (₹/km)</label>
                  <input
                    type="number"
                    value={newDistFee}
                    onChange={e => setNewDistFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Platform Commission (%)</label>
                  <input
                    type="number"
                    value={newPlatformFee}
                    onChange={e => setNewPlatformFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Delivery Fee (₹)</label>
                  <input
                    type="number"
                    value={newDelivFee}
                    onChange={e => setNewDelivFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Min Fare (₹)</label>
                  <input
                    type="number"
                    value={newMinFare}
                    onChange={e => setNewMinFare(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#464646] mb-1">Max Fare (₹)</label>
                  <input
                    type="number"
                    value={newMaxFare}
                    onChange={e => setNewMaxFare(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Publish Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
