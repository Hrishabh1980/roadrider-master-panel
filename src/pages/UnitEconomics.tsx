import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SectionHeader, ChartCard, Tabs, StatGroup, KPICard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { ordersApi, financeApi, dashboardApi } from '../services/api';

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black text-white text-xs rounded-lg p-3">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function UnitEconomics() {
  const [service, setService] = useState('All');
  const [city, setCity] = useState('Lucknow');

  // BUG-015 FIX: Pass service filter into orders query so KPIs reflect the selection
  const { data: ordersResponse } = useApi(
    () => ordersApi.getAll({ service: service === 'All' ? undefined : service, city: city === 'Lucknow' ? city : undefined }),
    { data: [], total: 0 },
    [service, city]
  );
  const { data: financeSummary } = useApi(() => financeApi.getSummary(), {
    grossVolume: '₹0',
    netRevenue: '₹0',
    processedTransactions: '0',
    pendingPayouts: '₹0',
    successRate: '100%'
  });
  const { data: revenueData } = useApi(() => dashboardApi.getRevenueChart(), []);

  const orders = ordersResponse?.data || [];
  const totalOrders = orders.length;
  const totalGrossNum = orders.reduce((sum, o) => {
    const amt = parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) || 0;
    return sum + amt;
  }, 0);

  const aov = totalOrders > 0 ? Math.round(totalGrossNum / totalOrders) : 0;
  const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;
  const cancelRatePct = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0.0';
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const completionRatePct = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '100.0';

  return (
    <div className="p-6">
      <SectionHeader title="Unit Economics" subtitle="Executive P&L and operational efficiency metrics derived from live order records">
        <select value={service} onChange={e => setService(e.target.value)}
          className="text-xs px-3 py-2 rounded border border-[#E8E8E8] bg-white outline-none">
          <option>All</option><option>Food</option><option>Grocery</option><option>Rides</option><option>Courier</option>
        </select>
        <select value={city} onChange={e => setCity(e.target.value)}
          className="text-xs px-3 py-2 rounded border border-[#E8E8E8] bg-white outline-none">
          <option>Lucknow</option>
        </select>
      </SectionHeader>

      {/* Top executive KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
          <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>AVERAGE ORDER VALUE (AOV)</p>
          <p className="text-3xl font-black font-mono-data tracking-tight text-black">₹{aov.toLocaleString()}</p>
          <p className="text-xs text-[#9C9A9A] mt-1">Calculated across {totalOrders} database orders</p>
        </div>

        <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
          <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>RECORDED GROSS VOLUME</p>
          <p className="text-3xl font-black font-mono-data tracking-tight text-[#A35E47]">{financeSummary?.grossVolume || '₹0'}</p>
          <p className="text-xs text-[#9C9A9A] mt-1">Transactions settled</p>
        </div>

        <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
          <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>PLATFORM REVENUE</p>
          <p className="text-3xl font-black font-mono-data tracking-tight text-black">{financeSummary?.netRevenue || '₹0'}</p>
          <p className="text-xs text-[#9C9A9A] mt-1">Net platform take-rate</p>
        </div>

        <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
          <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>ORDER COMPLETION RATE</p>
          <p className="text-3xl font-black font-mono-data tracking-tight text-emerald-600">{completionRatePct}%</p>
          <p className="text-xs text-[#9C9A9A] mt-1">{deliveredOrders} delivered successfully</p>
        </div>
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="TOTAL ORDERS RECORDED" value={String(totalOrders)} />
        <KPICard label="CANCELLED ORDERS" value={String(cancelledOrders)} highlight={cancelledOrders > 0} />
        <KPICard label="CANCELLATION RATE" value={`${cancelRatePct}%`} highlight={parseFloat(cancelRatePct) > 5} />
        <KPICard label="PAYMENT SUCCESS RATE" value={financeSummary?.successRate || '100%'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12">
          <ChartCard title="DAILY REVENUE AND VOLUME TREND">
            {revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenueData}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9C9A9A' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Line type="monotone" dataKey="gmv" stroke="#000000" strokeWidth={2} dot={{ fill: '#000000', r: 3 }} name="GMV ₹" />
                  <Line type="monotone" dataKey="revenue" stroke="#A35E47" strokeWidth={2} dot={{ fill: '#A35E47', r: 3 }} name="Revenue ₹" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-[#9C9A9A]">
                No revenue trend records available.
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Per-service breakdown */}
      <div className="mt-6 border border-[#E8E8E8] rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-[#E8E8E8]">
          <p className="text-sm font-bold">UNIT ECONOMICS BY SERVICE</p>
        </div>
        <table className="rr-table">
          <thead>
            <tr>
              <th>SERVICE</th>
              <th>ORDERS</th>
              <th>RECORDED GMV</th>
              <th>AVG ORDER VALUE</th>
              <th>COMPLETION %</th>
            </tr>
          </thead>
          <tbody>
            {['Food', 'Grocery', 'Rides', 'Courier'].map(svc => {
              const svcOrders = orders.filter(o => o.service === svc);
              const svcCount = svcOrders.length;
              const svcGross = svcOrders.reduce((sum, o) => {
                const amt = parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) || 0;
                return sum + amt;
              }, 0);
              const svcAov = svcCount > 0 ? Math.round(svcGross / svcCount) : 0;
              const svcDelivered = svcOrders.filter(o => o.status === 'Delivered').length;
              const svcCompRate = svcCount > 0 ? ((svcDelivered / svcCount) * 100).toFixed(0) : '—';

              return (
                <tr key={svc}>
                  <td><span className="font-bold text-black">{svc}</span></td>
                  <td className="font-bold font-mono-data">{svcCount}</td>
                  <td className="font-mono-data">₹{svcGross.toLocaleString()}</td>
                  <td className="font-mono-data">₹{svcAov.toLocaleString()}</td>
                  <td className="font-mono-data font-bold">{svcCompRate !== '—' ? `${svcCompRate}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
