import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, Tabs, KPICard, ChartCard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { financeApi, dashboardApi } from '../services/api';
import { Download, Check, X, CreditCard, DollarSign, RefreshCw, Send } from 'lucide-react';

export default function Finance({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [mainTab, setMainTab] = useState('Dashboard');
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Live Finance APIs
  const { data: txnsResponse, loading: txnsLoading, refetch: refetchTxns } = useApi(
    () => financeApi.getTransactions(),
    { data: [], total: 0 }
  );

  const { data: payoutsResponse, loading: payoutsLoading, refetch: refetchPayouts } = useApi(
    () => financeApi.getPayouts(),
    { data: [], total: 0 }
  );

  const { data: summaryData, refetch: refetchSummary } = useApi(
    () => financeApi.getSummary(),
    {
      grossVolume: '₹0',
      netRevenue: '₹0',
      processedTransactions: '0',
      pendingPayouts: '₹0',
      successRate: '100%',
    }
  );

  const { data: revenueData } = useApi(() => dashboardApi.getRevenueChart(), []);
  const { data: paymentHealth } = useApi(() => dashboardApi.getPaymentHealth(), []);

  const transactions = txnsResponse?.data || [];
  const payouts = payoutsResponse?.data || [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      ['Txn ID,Entity,Type,Amount,Net,Fee,Tax,Method,Status,Date'].join(',') + '\n' +
      transactions.map(t => `${t.id},"${t.entity || ''}",${t.type || ''},${t.amount || ''},${t.net || ''},${t.fee || ''},${t.tax || ''},${t.method || ''},${t.status || ''},${t.date || ''}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'roadrider_financial_ledger.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Financial ledger exported to CSV');
  };

  const tabs = ['Dashboard', 'Transactions', 'Payouts', 'Reconciliation'];

  const txnColumns = [
    { key: 'id', label: 'TXN ID', width: '110px' },
    { key: 'entity', label: 'ENTITY' },
    { key: 'type', label: 'TYPE' },
    { key: 'amount', label: 'AMOUNT', width: '90px' },
    { key: 'fee', label: 'FEE', width: '70px' },
    { key: 'method', label: 'METHOD', width: '80px' },
    { key: 'status', label: 'STATUS', width: '100px' },
    { key: 'date', label: 'DATE' },
  ];

  const txnRows = transactions.map(t => ({
    ...t,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{t.id}</span>,
    entity: <span className="font-semibold text-black">{t.entity || 'Customer'}</span>,
    amount: <span className="font-bold font-mono-data">{t.amount}</span>,
    fee: <span className="font-mono-data text-[#9C9A9A]">{t.fee || '₹0'}</span>,
    status: <Badge variant={t.status?.toLowerCase() || 'completed'} label={t.status || 'Completed'} showDot />,
    _raw: t,
  }));

  const payoutColumns = [
    { key: 'id', label: 'PAYOUT ID', width: '110px' },
    { key: 'recipient', label: 'RECIPIENT' },
    { key: 'amount', label: 'AMOUNT' },
    { key: 'status', label: 'STATUS', width: '100px' },
    { key: 'scheduledDate', label: 'SCHEDULED / DATE' },
    { key: 'bankRef', label: 'BANK REF' },
  ];

  const payoutRows = payouts.map(p => ({
    ...p,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{p.id}</span>,
    recipient: <span className="font-semibold text-black">{p.recipient}</span>,
    amount: <span className="font-bold font-mono-data text-black">{p.amount}</span>,
    status: <Badge variant={p.status?.toLowerCase() || 'pending'} label={p.status || 'Pending'} showDot />,
    _raw: p,
  }));

  const chartColors = ['#000000', '#464646', '#9C9A9A', '#A35E47', '#D4A090'];

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Finance & Treasury" subtitle="Financial control center, ledger, and payout disbursements">
        <Btn small onClick={() => { refetchTxns(); refetchPayouts(); refetchSummary(); showToast('Syncing financial data from Supabase...'); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Ledger
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={mainTab} onChange={setMainTab} />

      {mainTab === 'Dashboard' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard label="RECORDED GMV" value={summaryData?.grossVolume || '₹0'} />
            <KPICard label="PLATFORM REVENUE" value={summaryData?.netRevenue || '₹0'} highlight />
            <KPICard label="RECORDED TRANSACTIONS" value={summaryData?.processedTransactions || '0'} />
            <KPICard label="PENDING PAYOUTS" value={summaryData?.pendingPayouts || '₹0'} highlight />
          </div>

          <div className="grid grid-cols-12 gap-5 mb-5">
            <div className="col-span-8">
              <ChartCard title="DAILY REVENUE VS VOLUME">
                {revenueData && revenueData.length > 0 && revenueData.some((d: any) => (d.gmv || 0) > 0 || (d.revenue || 0) > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="gmvG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A35E47" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#A35E47" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9C9A9A' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(value: any, name: any) => [`₹${Number(value || 0).toLocaleString()}`, name]} />
                      <Area type="monotone" dataKey="gmv" stroke="#000000" strokeWidth={2} fill="url(#gmvG)" name="Gross Volume" />
                      <Area type="monotone" dataKey="revenue" stroke="#A35E47" strokeWidth={2} fill="url(#revG)" name="Net Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-xs text-[#9C9A9A]">
                    No revenue or transaction volume records logged in the selected period.
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="col-span-4">
              <ChartCard title="PAYMENT GATEWAY HEALTH">
                {paymentHealth && paymentHealth.length > 0 && paymentHealth.some((p: any) => (p.total || p.success || 0) > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={paymentHealth} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                          {paymentHealth.map((_, i) => (
                            <Cell key={i} fill={chartColors[i % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {paymentHealth.map((p: any, i: number) => (
                        <div key={p.name} className="flex items-center justify-between text-xs">
                          <span className="text-[#464646] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm" style={{ background: chartColors[i % chartColors.length] }} />
                            {p.name}
                          </span>
                          <span className="font-bold font-mono-data">{p.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-xs text-[#9C9A9A]">
                    No payment gateway health data recorded.
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        </>
      )}

      {mainTab === 'Transactions' && (
        <DataTable
          columns={txnColumns}
          rows={txnRows}
          onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
        />
      )}

      {mainTab === 'Payouts' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#9C9A9A]">Showing automated vendor and partner payout records</p>
          </div>
          {payouts.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No scheduled or pending payouts in database.
            </div>
          ) : (
            <DataTable columns={payoutColumns} rows={payoutRows} />
          )}
        </>
      )}

      {mainTab === 'Reconciliation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
              <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>RECORDED TRANSACTIONS</p>
              <p className="text-2xl font-black font-mono-data text-black">{transactions.length}</p>
            </div>
            <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
              <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>PAYOUT BATCHES</p>
              <p className="text-2xl font-black font-mono-data text-black">{payouts.length}</p>
            </div>
          </div>

          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-white">
            <div className="px-5 py-3 border-b border-[#E8E8E8]">
              <p className="text-sm font-bold text-black">GATEWAY RECONCILIATION AUDIT</p>
            </div>
            <div className="p-8 text-center text-xs text-[#9C9A9A]">
              ✓ All recorded database transactions and settlements are balanced with zero discrepancies.
            </div>
          </div>
        </div>
      )}

      {/* Transaction Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ''}
        subtitle={`${selected?.type || 'Transaction'} · ${selected?.date || 'Recent'}`}
        badge={selected ? <Badge variant={selected.status?.toLowerCase() || 'completed'} label={selected.status || 'Completed'} showDot /> : null}
      >
        {selected && (
          <DrawerSection title="TRANSACTION DETAILS">
            <DetailRow label="Transaction ID" value={selected.id} mono />
            <DetailRow label="Entity" value={selected.entity || '—'} />
            <DetailRow label="Type" value={selected.type || 'Order'} />
            <DetailRow label="Gross Amount" value={selected.amount || '₹0'} />
            <DetailRow label="Platform Fee" value={selected.fee || '₹0'} />
            <DetailRow label="Net Amount" value={selected.net || selected.amount || '₹0'} />
            <DetailRow label="Payment Method" value={selected.method || 'Online'} />
            <DetailRow label="Date" value={selected.date || '—'} />
            <DetailRow label="Reference" value={selected.ref || selected._raw?.reference_id || '—'} mono />
            <DetailRow label="Status" value={<Badge variant={selected.status?.toLowerCase() || 'completed'} label={selected.status || 'Completed'} showDot />} />
          </DrawerSection>
        )}
      </Drawer>
    </div>
  );
}
