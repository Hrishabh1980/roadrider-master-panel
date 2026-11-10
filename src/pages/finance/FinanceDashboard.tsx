import React, { useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  SectionHeader,
  DataTable,
  Badge,
  Drawer,
  DrawerSection,
  DetailRow,
  Btn,
  KPICard,
  ChartCard,
} from "../../components/ui"
import { useApi } from "../../hooks/useApi"
import { financeApi, dashboardApi } from "../../services/api"
import {
  Download,
  Check,
  RefreshCw,
  ArrowRight,
  ArrowLeftRight,
  CreditCard,
  RotateCcw,
  DollarSign,
  AlertCircle,
  Wallet,
} from "lucide-react"

export default function FinanceDashboard({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { data: summaryData, refetch: refetchSummary } = useApi(
    () => financeApi.getSummary(),
    {
      grossVolume: "₹4,829,350",
      netRevenue: "₹482,935",
      processedTransactions: "1,428",
      pendingPayouts: "₹84,200",
      successRate: "99.2%",
    },
  )

  const { data: txnsResponse, refetch: refetchTxns } = useApi(
    () => financeApi.getTransactions(),
    { data: [], total: 0 },
  )

  const { data: payoutsResponse, refetch: refetchPayouts } = useApi(
    () => financeApi.getPayouts(),
    { data: [], total: 0 },
  )

  const { data: revenueData } = useApi(() => dashboardApi.getRevenueChart(), [])
  const { data: paymentHealth } = useApi(
    () => dashboardApi.getPaymentHealth(),
    [],
  )

  const transactions = txnsResponse?.data || []
  const payouts = payoutsResponse?.data || []

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Metric,Value"].join(",") +
      "\n" +
      `Recorded GMV,"${summaryData.grossVolume}"\n` +
      `Platform Revenue,"${summaryData.netRevenue}"\n` +
      `Recorded Transactions,"${summaryData.processedTransactions}"\n` +
      `Pending Payouts,"${summaryData.pendingPayouts}"\n` +
      `Success Rate,"${summaryData.successRate}"\n`
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_finance_overview.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Executive financial summary exported to CSV")
  }

  const chartColors = ["#000000", "#464646", "#9C9A9A", "#A35E47", "#D4A090"]

  const recentTxnColumns = [
    { key: "id", label: "TXN ID", width: "120px" },
    { key: "entity", label: "ENTITY" },
    { key: "type", label: "TYPE" },
    { key: "amount", label: "AMOUNT", width: "100px" },
    { key: "method", label: "METHOD", width: "90px" },
    { key: "status", label: "STATUS", width: "110px" },
    { key: "date", label: "DATE" },
  ]

  const recentTxnRows = transactions.slice(0, 5).map((t) => ({
    ...t,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">
        {t.id}
      </span>
    ),
    entity: (
      <span className="font-semibold text-black">{t.entity || "Customer"}</span>
    ),
    amount: <span className="font-bold font-mono-data">{t.amount}</span>,
    method: (
      <span className="text-xs font-mono-data text-[#464646]">{t.method}</span>
    ),
    status: (
      <Badge
        variant={t.status?.toLowerCase() || "completed"}
        label={t.status || "Completed"}
        showDot
      />
    ),
    _raw: t,
  }))

  const submodules = [
    {
      id: "transactions",
      label: "Transactions",
      count: summaryData?.processedTransactions || "1,428",
      icon: <ArrowLeftRight className="w-4 h-4 text-[#A35E47]" />,
    },
    {
      id: "payments",
      label: "Payments",
      count: "99.4% Verified",
      icon: <CreditCard className="w-4 h-4 text-[#A35E47]" />,
    },
    {
      id: "refunds",
      label: "Refunds & Disputes",
      count: "3 Pending",
      icon: <RotateCcw className="w-4 h-4 text-[#A35E47]" />,
    },
    {
      id: "payouts",
      label: "Payouts",
      count: summaryData?.pendingPayouts || "₹84,200",
      icon: <DollarSign className="w-4 h-4 text-[#A35E47]" />,
    },
    {
      id: "reconciliation",
      label: "Reconciliation",
      count: "99.8% Balanced",
      icon: <AlertCircle className="w-4 h-4 text-[#A35E47]" />,
    },
    {
      id: "wallet",
      label: "Wallet Ledger",
      count: "Active Liability",
      icon: <Wallet className="w-4 h-4 text-[#A35E47]" />,
    },
  ]

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader
        title="Finance Dashboard"
        subtitle="Executive financial control center, GMV, and gateway performance"
      >
        <Btn
          small
          onClick={() => {
            refetchTxns()
            refetchPayouts()
            refetchSummary()
            showToast("Synchronized live financial feeds")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Overview
        </Btn>
      </SectionHeader>

      {/* Quick Nav Submodule Strip */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {submodules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onNavigate?.(mod.id)}
            className="flex flex-col text-left p-3.5 rounded-xl border border-[#E8E8E8] bg-white hover:border-[#A35E47] transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-1.5 rounded-lg bg-[#FFF8F0] group-hover:scale-110 transition-transform">
                {mod.icon}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#9C9A9A] group-hover:text-black group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-xs font-bold text-black group-hover:text-[#A35E47] transition-colors">
              {mod.label}
            </p>
            <p className="text-[11px] text-[#9C9A9A] font-mono-data mt-0.5">
              {mod.count}
            </p>
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="RECORDED GMV"
          value={summaryData?.grossVolume || "₹0"}
          sub="Gross Merchandise Volume"
        />
        <KPICard
          label="PLATFORM REVENUE"
          value={summaryData?.netRevenue || "₹0"}
          sub="Net Take Rate & Commissions"
          highlight
        />
        <KPICard
          label="RECORDED TRANSACTIONS"
          value={summaryData?.processedTransactions || "0"}
          sub="Settled Ledger Entries"
        />
        <KPICard
          label="PENDING PAYOUTS"
          value={summaryData?.pendingPayouts || "₹0"}
          sub="Partner & Merchant Queue"
          highlight
        />
      </div>

      {/* Financial Analytics Charts */}
      <div className="grid grid-cols-12 gap-5 mb-6">
        <div className="col-span-8">
          <ChartCard title="DAILY REVENUE VS VOLUME">
            {revenueData &&
            revenueData.length > 0 &&
            revenueData.some(
              (d: any) => (d.gmv || 0) > 0 || (d.revenue || 0) > 0,
            ) ? (
              <ResponsiveContainer width="100%" height={230}>
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
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#9C9A9A" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `₹${Number(value || 0).toLocaleString()}`,
                      name,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="gmv"
                    stroke="#000000"
                    strokeWidth={2}
                    fill="url(#gmvG)"
                    name="Gross Volume"
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#A35E47"
                    strokeWidth={2}
                    fill="url(#revG)"
                    name="Platform Net Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[230px] flex items-center justify-center text-xs text-[#9C9A9A]">
                No revenue or transaction volume records logged in the selected
                period.
              </div>
            )}
          </ChartCard>
        </div>

        <div className="col-span-4">
          <ChartCard title="PAYMENT GATEWAY HEALTH">
            {paymentHealth &&
            paymentHealth.length > 0 &&
            paymentHealth.some((p: any) => (p.total || p.success || 0) > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={paymentHealth}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {paymentHealth.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColors[i % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {paymentHealth.map((p: any, i: number) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-[#464646] flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-sm"
                          style={{
                            background: chartColors[i % chartColors.length],
                          }}
                        />
                        {p.name}
                      </span>
                      <span className="font-bold font-mono-data">
                        {p.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[210px] flex items-center justify-center text-xs text-[#9C9A9A]">
                No payment gateway health data recorded.
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Snapshot Tables: Recent Transactions */}
      <div className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-white mb-6">
        <div className="px-5 py-3.5 border-b border-[#E8E8E8] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-black uppercase tracking-wider">
              Recent Transactions Snapshot
            </h3>
            <p className="text-xs text-[#9C9A9A]">
              Most recent settling orders and platform transfers
            </p>
          </div>
          <Btn
            small
            variant="ghost"
            onClick={() => onNavigate?.("transactions")}
          >
            View Full Ledger <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Btn>
        </div>
        <DataTable
          columns={recentTxnColumns}
          rows={recentTxnRows}
          onRowClick={(row) => {
            setSelected((row as any)._raw)
            setDrawerOpen(true)
          }}
        />
      </div>

      {/* Transaction Inspection Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ""}
        subtitle={`${selected?.type || "Transaction"} · ${selected?.date || "Recent"}`}
        badge={
          selected ? (
            <Badge
              variant={selected.status?.toLowerCase() || "completed"}
              label={selected.status || "Completed"}
              showDot
            />
          ) : null
        }
      >
        {selected && (
          <DrawerSection title="TRANSACTION BREAKDOWN">
            <DetailRow label="Transaction ID" value={selected.id} mono />
            <DetailRow
              label="Order Reference"
              value={selected.orderId || "—"}
              mono
            />
            <DetailRow label="Entity" value={selected.entity || "—"} />
            <DetailRow
              label="Transaction Type"
              value={selected.type || "Order Payment"}
            />
            <DetailRow label="Gross Amount" value={selected.amount || "₹0"} />
            <DetailRow
              label="Platform Commission"
              value={selected.fee || "₹0"}
            />
            <DetailRow label="Tax (GST 18%)" value={selected.tax || "₹0"} />
            <DetailRow
              label="Net Settled"
              value={selected.net || selected.amount || "₹0"}
            />
            <DetailRow
              label="Payment Method"
              value={selected.method || "Online"}
            />
            <DetailRow
              label="Gateway Reference"
              value={selected.ref || "—"}
              mono
            />
            <DetailRow
              label="Service Domain"
              value={selected.service || "Food"}
            />
            <DetailRow
              label="Zone"
              value={selected.zone || "Lucknow Central"}
            />
            <DetailRow label="Timestamp" value={selected.date || "—"} />
          </DrawerSection>
        )}
      </Drawer>
    </div>
  )
}
