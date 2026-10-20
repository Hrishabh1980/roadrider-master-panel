import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { SectionHeader, KPICard, ChartCard, Tabs, StatGroup } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { analyticsApi, dashboardApi, financeApi } from '../services/api';
import { RefreshCw } from 'lucide-react';

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black text-white text-xs rounded-lg p-3 shadow-lg">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex gap-3 justify-between">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">{typeof p.value === 'number' && p.value > 1000 ? `₹${p.value.toLocaleString()}` : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [tab, setTab] = useState('Business');
  const [period, setPeriod] = useState('Last 7 Days');
  const tabs = ['Business', 'Operations', 'Customer', 'Partner', 'Financial'];

  const { data: businessStats, loading, refetch: refetchBusiness } = useApi(
    () => analyticsApi.getBusiness(period),
    { totalOrders: 0, totalCustomers: 0, totalVendors: 0, totalPartners: 0 },
    [period]
  );

  const { data: revenueData } = useApi(() => dashboardApi.getRevenueChart(), []);
  const { data: orderTrend } = useApi(() => dashboardApi.getOrderTrend(), []);
  const { data: cancelTrend } = useApi(() => dashboardApi.getCancellationTrend(), []);
  const { data: partnerAvail } = useApi(() => dashboardApi.getPartnerAvailability(), []);
  const { data: financeSummary } = useApi(() => financeApi.getSummary(), {
    grossVolume: '₹0',
    netRevenue: '₹0',
    processedTransactions: '0',
    pendingPayouts: '₹0',
    successRate: '100%'
  });

  return (
    <div className="p-6">
      <SectionHeader title="Business Analytics" subtitle="Performance metrics and operational insights">
        <button
          onClick={() => refetchBusiness()}
          className="p-2 border border-[#E8E8E8] rounded-xl hover:bg-[#F5F5F5] mr-2"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="text-xs px-3 py-2 rounded border border-[#E8E8E8] bg-white outline-none cursor-pointer"
        >
          <option>Last 7 Days</option>
          <option>Last 30 Days</option>
          <option>Last Quarter</option>
        </select>
      </SectionHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Business' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard label="TOTAL RECORDED GMV" value={financeSummary?.grossVolume || '₹0'} />
            <KPICard label="NET PLATFORM REVENUE" value={financeSummary?.netRevenue || '₹0'} highlight />
            <KPICard label="TOTAL ORDERS" value={String(businessStats?.totalOrders || 0)} />
            <KPICard label="REGISTERED CUSTOMERS" value={String(businessStats?.totalCustomers || 0)} />
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-8">
              <ChartCard title="DAILY REVENUE VS VOLUME">
                {revenueData && revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#000000" stopOpacity={0.08} />
                          <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9C9A9A' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<CUSTOM_TOOLTIP />} />
                      <Area type="monotone" dataKey="gmv" stroke="#000000" strokeWidth={2} fill="url(#ag1)" name="Gross Volume" />
                      <Line type="monotone" dataKey="revenue" stroke="#A35E47" strokeWidth={2} name="Net Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-xs text-[#9C9A9A]">
                    No revenue records in database.
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="col-span-4">
              <ChartCard title="ECOSYSTEM OVERVIEW">
                <div className="space-y-4 p-2">
                  <div className="flex justify-between items-center text-xs border-b border-[#F0F0F0] pb-2">
                    <span className="text-[#464646]">Active Vendors</span>
                    <span className="font-bold font-mono-data text-sm">{businessStats?.totalVendors || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-[#F0F0F0] pb-2">
                    <span className="text-[#464646]">Delivery Partners</span>
                    <span className="font-bold font-mono-data text-sm">{businessStats?.totalPartners || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-[#F0F0F0] pb-2">
                    <span className="text-[#464646]">Customer Accounts</span>
                    <span className="font-bold font-mono-data text-sm">{businessStats?.totalCustomers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1">
                    <span className="text-[#464646]">Completed Orders</span>
                    <span className="font-bold font-mono-data text-sm">{businessStats?.totalOrders || 0}</span>
                  </div>
                </div>
              </ChartCard>
            </div>
          </div>
        </>
      )}

      {tab === 'Operations' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KPICard label="TOTAL ORDERS" value={String(businessStats?.totalOrders || 0)} />
            <KPICard label="ACTIVE PARTNERS" value={String(businessStats?.totalPartners || 0)} />
            <KPICard label="ACTIVE VENDORS" value={String(businessStats?.totalVendors || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <ChartCard title="CANCELLATION RATE">
              {cancelTrend && cancelTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={cancelTrend}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9C9A9A' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Line type="monotone" dataKey="rate" stroke="#A35E47" strokeWidth={2} dot={{ fill: '#A35E47', r: 3 }} name="Cancel %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-xs text-[#9C9A9A]">No cancellation trends recorded.</div>
              )}
            </ChartCard>

            <ChartCard title="PARTNER AVAILABILITY">
              {partnerAvail && partnerAvail.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={partnerAvail} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="zone" tick={{ fontSize: 10, fill: '#9C9A9A' }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Bar dataKey="online" fill="#000000" name="Online" stackId="a" maxBarSize={16} />
                    <Bar dataKey="busy" fill="#9C9A9A" name="Busy" stackId="a" maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-xs text-[#9C9A9A]">No partner telemetry recorded.</div>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {tab === 'Customer' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KPICard label="TOTAL CUSTOMERS" value={String(businessStats?.totalCustomers || 0)} />
          <KPICard label="TOTAL ORDERS" value={String(businessStats?.totalOrders || 0)} />
          <KPICard label="ORDERS PER CUSTOMER" value={businessStats?.totalCustomers ? (businessStats.totalOrders / businessStats.totalCustomers).toFixed(1) : '0'} />
        </div>
      )}

      {tab === 'Partner' && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <KPICard label="REGISTERED PARTNERS" value={String(businessStats?.totalPartners || 0)} />
          <KPICard label="PARTNER STATUS" value="Active Delivery Network" />
        </div>
      )}

      {tab === 'Financial' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KPICard label="TOTAL GMV" value={financeSummary?.grossVolume || '₹0'} />
          <KPICard label="NET PLATFORM REVENUE" value={financeSummary?.netRevenue || '₹0'} highlight />
          <KPICard label="SETTLED TRANSACTIONS" value={financeSummary?.processedTransactions || '0'} />
        </div>
      )}
    </div>
  );
}
