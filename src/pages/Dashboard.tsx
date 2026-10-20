import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { AlertCircle, Clock, UserCheck, Store, CreditCard, Flag, MapPin, Zap, TrendingDown, RefreshCw, CheckCircle2 } from 'lucide-react';
import { KPICard, ChartCard, Badge, LiveDot, AlertBanner } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { dashboardApi, citiesApi, kycApi, vendorsApi, supportApi } from '../services/api';

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black text-white text-xs rounded-lg p-3 shadow-lg min-w-28">
      <p className="font-bold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [cityFilter, setCityFilter] = useState('All Cities');
  const [serviceFilter, setServiceFilter] = useState('All Services');

  // Real backend queries via Supabase integration
  const { data: citiesData } = useApi(() => citiesApi.getAll(), []);
  const { data: summaryData, loading, error, refetch } = useApi(
    () => dashboardApi.getSummary(cityFilter === 'All Cities' ? undefined : cityFilter),
    undefined,
    [cityFilter]
  );

  const { data: liveJobsData } = useApi(
    () => dashboardApi.getLiveJobs(),
    [],
    [cityFilter]
  );

  const { data: revenueChartData } = useApi(
    () => dashboardApi.getRevenueChart(7),
    [],
    [cityFilter]
  );

  const { data: orderTrendData } = useApi(
    () => dashboardApi.getOrderTrend(),
    [],
    [cityFilter]
  );

  const { data: partnerAvailData } = useApi(
    () => dashboardApi.getPartnerAvailability(),
    [],
    [cityFilter]
  );

  const { data: paymentHealthData } = useApi(
    () => dashboardApi.getPaymentHealth(),
    [],
    [cityFilter]
  );

  const { data: cancelTrendData } = useApi(
    () => dashboardApi.getCancellationTrend(),
    [],
    [cityFilter]
  );

  // Live alerts from Supabase
  const { data: pendingKycData } = useApi(() => kycApi.getAll({ status: 'pending' }), []);
  const { data: pendingVendorsData } = useApi(() => vendorsApi.getPendingApprovals(), []);
  const { data: openTicketsData } = useApi(() => supportApi.getTickets({ status: 'open' }), { data: [], total: 0 });

  const citiesList = (citiesData || []).map((c: any) => c.name);
  const revenueData = revenueChartData || [];
  const liveJobs = liveJobsData || [];
  const orderTrend = orderTrendData || [];
  const partnerAvail = partnerAvailData || [];
  const paymentHealth = paymentHealthData || [];
  const cancelTrend = cancelTrendData || [];

  // Compute live attention items based on actual database counts
  const needsAttentionItems: Array<{ icon: React.ReactNode; label: string; sub: string; type: 'warning' | 'info'; targetPage: string }> = [];

  const pendingKycCount = pendingKycData?.length || 0;
  if (pendingKycCount > 0) {
    needsAttentionItems.push({
      icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
      label: `${pendingKycCount} KYC document${pendingKycCount > 1 ? 's' : ''} awaiting review`,
      sub: 'Vendor and partner identity verification',
      type: 'warning',
      targetPage: 'kyc',
    });
  }

  const pendingVendorsCount = pendingVendorsData?.length || 0;
  if (pendingVendorsCount > 0) {
    needsAttentionItems.push({
      icon: <Store className="w-4 h-4 text-blue-600" />,
      label: `${pendingVendorsCount} vendor application${pendingVendorsCount > 1 ? 's' : ''} submitted`,
      sub: 'Review onboarding and store profile',
      type: 'info',
      targetPage: 'vendors',
    });
  }

  const openTicketsCount = openTicketsData?.data?.length || 0;
  if (openTicketsCount > 0) {
    needsAttentionItems.push({
      icon: <Clock className="w-4 h-4 text-[#A35E47]" />,
      label: `${openTicketsCount} open support ticket${openTicketsCount > 1 ? 's' : ''}`,
      sub: 'Pending partner & customer inquiries',
      type: 'warning',
      targetPage: 'support',
    });
  }

  if (needsAttentionItems.length === 0) {
    needsAttentionItems.push({
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      label: 'All systems operational',
      sub: 'Zero pending operational alerts in queue',
      type: 'info',
      targetPage: 'dashboard',
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>ROADRIDER — MASTER ADMIN</p>
          <h1 className="text-3xl font-black tracking-tight text-black">Operations Overview</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm text-[#9C9A9A]">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            <span className="text-[#9C9A9A]">·</span>
            <LiveDot />
            <span className="text-sm text-[#9C9A9A]">Live Supabase connection</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-rose-600 font-medium mr-1">{error}</span>
          )}
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-[#E8E8E8] bg-white text-black outline-none cursor-pointer"
          >
            <option>All Cities</option>
            {citiesList.map(c => <option key={c}>{c}</option>)}
          </select>
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-[#E8E8E8] bg-white text-black outline-none cursor-pointer"
          >
            <option>All Services</option>
            <option>Food</option><option>Grocery</option><option>Rides</option><option>Courier</option>
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-black text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            title="Refresh backend data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 xl:grid-cols-8">
        <KPICard label="ACTIVE JOBS" value={summaryData?.activeJobs ?? '0'} trend="Live" />
        <KPICard label="ACTIVE PARTNERS" value={summaryData?.activePartners ?? '0'} trend="Verified" />
        <KPICard label="TODAY'S ORDERS" value={summaryData?.todayOrders ?? '0'} trend="Real-time" />
        <KPICard label="GMV" value={summaryData?.gmv ?? '₹0'} trend="Gross" />
        <KPICard label="REVENUE" value={summaryData?.revenue ?? '₹0'} trend="Platform" highlight />
        <KPICard label="CANCELLATION" value={summaryData?.cancellation ?? '0.0%'} sub="Target < 5%" trend="Actual" />
        <KPICard label="ON-TIME" value={summaryData?.onTime ?? '100%'} sub="Target > 90%" trend="Target" />
        <KPICard label="PAYMENT SUCCESS" value={summaryData?.paymentSuccess ?? '100%'} sub="Last 24h" trend="Actual" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Revenue trend */}
        <div className="col-span-8">
          <ChartCard title="REVENUE & GMV — RECENT"
            action={<span className="text-xs text-[#9C9A9A]">₹ INR</span>}>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A35E47" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#A35E47" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9C9A9A' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Area type="monotone" dataKey="food" stroke="#000000" strokeWidth={2}
                    fill="url(#gmvGrad)" name="Food Revenue" />
                  <Area type="monotone" dataKey="grocery" stroke="#A35E47" strokeWidth={2}
                    fill="url(#revGrad)" name="Grocery Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-[#9C9A9A]">
                No transaction revenue records logged in selected period
              </div>
            )}
            <div className="flex items-center gap-5 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-[#464646]">
                <span className="w-3 h-0.5 bg-black rounded" />Food
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#464646]">
                <span className="w-3 h-0.5 bg-[#A35E47] rounded" />Grocery
              </span>
            </div>
          </ChartCard>
        </div>

        {/* Payment health */}
        <div className="col-span-4">
          <ChartCard title="PAYMENT METHODS">
            {paymentHealth.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={paymentHealth} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                      dataKey="success" strokeWidth={0}>
                      {paymentHealth.map((_, i) => (
                        <Cell key={i}
                          fill={['#000000', '#464646', '#9C9A9A', '#A35E47', '#D4A090'][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                  {paymentHealth.map((p, i) => (
                    <div key={p.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm"
                          style={{ background: ['#000000', '#464646', '#9C9A9A', '#A35E47', '#D4A090'][i % 5] }} />
                        <span className="text-xs text-[#464646]">{p.method}</span>
                      </div>
                      <span className="text-xs font-bold font-mono-data">{p.pct}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-[#9C9A9A]">
                No payment transactions logged yet
              </div>
            )}
          </ChartCard>
        </div>

        {/* Orders by service */}
        <div className="col-span-6">
          <ChartCard title="ORDERS BY SERVICE — TIME DISTRIBUTION">
            {orderTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={orderTrend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9C9A9A' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Bar dataKey="food" fill="#000000" name="Food" radius={[2, 2, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="grocery" fill="#464646" name="Grocery" radius={[2, 2, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="rides" fill="#9C9A9A" name="Rides" radius={[2, 2, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="courier" fill="#A35E47" name="Courier" radius={[2, 2, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-[#9C9A9A]">
                No order trends available
              </div>
            )}
            <div className="flex items-center gap-4 mt-3">
              {[['Food', '#000000'], ['Grocery', '#464646'], ['Rides', '#9C9A9A'], ['Courier', '#A35E47']].map(([n, c]) => (
                <span key={n} className="flex items-center gap-1.5 text-xs text-[#464646]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c }} />{n}
                </span>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* Partner availability */}
        <div className="col-span-6">
          <ChartCard title="PARTNER AVAILABILITY BY ZONE">
            {partnerAvail.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={partnerAvail} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="zone" tick={{ fontSize: 10, fill: '#9C9A9A' }}
                    axisLine={false} tickLine={false} width={65} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Bar dataKey="available" fill="#000000" name="Available" stackId="a" maxBarSize={16} />
                  <Bar dataKey="onTrip" fill="#9C9A9A" name="On Trip" stackId="a" maxBarSize={16} />
                  <Bar dataKey="offline" fill="#E8E8E8" name="Offline" stackId="a" maxBarSize={16} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-[#9C9A9A]">
                No partner zone distributions active
              </div>
            )}
          </ChartCard>
        </div>

        {/* Live operations feed */}
        <div className="col-span-8">
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8E8]">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-black">LIVE OPERATIONS</p>
                <LiveDot />
              </div>
              <button onClick={() => onNavigate('live-jobs')}
                className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">
                View All Live Jobs →
              </button>
            </div>
            {liveJobs.length > 0 ? (
              <div className="divide-y divide-[#F0F0F0]">
                {liveJobs.slice(0, 6).map(job => (
                  <div
                    key={job.id}
                    onClick={() => onNavigate('live-jobs')}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-[10px] font-bold text-[#9C9A9A]">{job.id}</p>
                    </div>
                    <Badge variant={job.service.toLowerCase()} label={job.service} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-black truncate">{job.pickup} → {job.dest}</p>
                      <p className="text-[10px] text-[#9C9A9A]">{job.customer} · {job.partner}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={job.status.toLowerCase().replace(' ', '')} label={job.status} showDot />
                      {job.flag && (
                        <p className="text-[10px] font-semibold text-[#A35E47] mt-0.5">{job.flag}</p>
                      )}
                    </div>
                    <div className="text-right w-12 shrink-0">
                      <p className="text-xs font-bold font-mono-data">{job.eta}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#9C9A9A]">
                No active jobs currently in transit
              </div>
            )}
          </div>
        </div>

        {/* Needs attention */}
        <div className="col-span-4">
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden h-full">
            <div className="px-5 py-3 border-b border-[#E8E8E8]">
              <p className="text-sm font-bold text-black">NEEDS ATTENTION</p>
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {needsAttentionItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(item.targetPage)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFA] transition-colors text-left cursor-pointer group"
                >
                  <span className="shrink-0">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-black group-hover:text-[#A35E47] transition-colors">{item.label}</p>
                    <p className="text-[10px] text-[#9C9A9A]">{item.sub}</p>
                  </div>
                  <span className="text-[#9C9A9A] text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
