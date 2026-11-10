import React, { useState } from "react"
import {
  SectionHeader,
  DataTable,
  Badge,
  FilterBar,
  Drawer,
  DrawerSection,
  DetailRow,
  Btn,
  KPICard,
} from "../../components/ui"
import { useApi } from "../../hooks/useApi"
import { financeApi } from "../../services/api"
import {
  Download,
  RefreshCw,
  Check,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Activity,
  ArrowUpRight,
} from "lucide-react"

export default function Payments({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [search, setSearch] = useState("")
  const [gatewayFilter, setGatewayFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const {
    data: response,
    loading,
    refetch,
  } = useApi(
    () =>
      financeApi.getPayments({
        search,
        gateway: gatewayFilter,
        method: methodFilter,
        status: statusFilter,
      }),
    {
      data: [],
      total: 0,
      stats: {
        totalPayments: 0,
        totalVolume: "₹0",
        captured: 0,
        pending: 0,
        failed: 0,
      },
      methodDistribution: [],
    },
    [search, gatewayFilter, methodFilter, statusFilter],
  )

  const payments = response?.data || []
  const stats = response?.stats || {
    totalPayments: payments.length,
    totalVolume: "₹0",
    captured: 0,
    pending: 0,
    failed: 0,
  }
  const distribution = response?.methodDistribution || []

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleVerify = async (paymentId: string) => {
    setVerifyingId(paymentId)
    try {
      const res = await financeApi.verifyPayment(paymentId)
      showToast(res.message)
      refetch()
    } catch {
      showToast("Gateway status check failed")
    } finally {
      setVerifyingId(null)
    }
  }

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Payment ID,Order ID,Customer,Amount,Gateway,Gateway Ref,Method,Status,Verification,Date",
      ].join(",") +
      "\n" +
      payments
        .map(
          (p: any) =>
            `"${p.id}","${p.orderId}","${p.customerName}","${p.amount}","${p.gateway}","${p.gatewayRef}","${p.method}","${p.status}","${p.verificationStatus}","${p.date}"`,
        )
        .join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_gateway_payments.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Payment records exported to CSV")
  }

  const columns = [
    { key: "id", label: "PAYMENT ID", width: "120px" },
    { key: "orderId", label: "ORDER ID", width: "110px" },
    { key: "customerName", label: "CUSTOMER" },
    { key: "gateway", label: "GATEWAY", width: "120px" },
    { key: "gatewayRef", label: "GATEWAY REF", width: "150px" },
    { key: "method", label: "METHOD", width: "110px" },
    { key: "amount", label: "AMOUNT", width: "90px" },
    { key: "status", label: "GATEWAY STATUS", width: "120px" },
    { key: "verificationStatus", label: "AUDIT VERIFICATION", width: "140px" },
    { key: "actions", label: "ACTION", width: "100px" },
  ]

  const rows = payments.map((p: any) => ({
    ...p,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {p.id}
      </span>
    ),
    orderId: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">{p.orderId}</span>
    ),
    customerName: (
      <div>
        <p className="font-semibold text-black text-xs">{p.customerName}</p>
        <p className="text-[10px] text-[#9C9A9A]">
          {p.customerPhone || p.customerEmail || ""}
        </p>
      </div>
    ),
    gateway: (
      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F5F5F5] text-black">
        {p.gateway}
      </span>
    ),
    gatewayRef: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">
        {p.gatewayRef}
      </span>
    ),
    method: (
      <span className="text-xs font-mono-data font-semibold text-[#464646]">
        {p.method}
      </span>
    ),
    amount: (
      <span className="font-bold font-mono-data text-black">{p.amount}</span>
    ),
    status: (
      <Badge
        variant={
          p.status === "Captured"
            ? "completed"
            : p.status === "Failed"
              ? "failed"
              : "pending"
        }
        label={p.status}
        showDot
      />
    ),
    verificationStatus: (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          p.verificationStatus === "Verified"
            ? "text-black"
            : p.verificationStatus === "Failed Check"
              ? "text-[#A35E47]"
              : "text-[#9C9A9A]"
        }`}
      >
        {p.verificationStatus === "Verified" ? (
          <ShieldCheck className="w-3.5 h-3.5" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5" />
        )}
        {p.verificationStatus}
      </span>
    ),
    actions: (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setSelected(p)
          setDrawerOpen(true)
        }}
        className="text-xs text-[#A35E47] font-semibold hover:underline"
      >
        Inspect
      </button>
    ),
  }))

  const filtersConfig = [
    {
      label: "All Gateways",
      options: ["Razorpay", "Cashfree", "PayU", "RoadRider Wallet", "Offline"],
      value: gatewayFilter,
      onChange: setGatewayFilter,
    },
    {
      label: "All Methods",
      options: [
        "UPI",
        "Credit Card",
        "Debit Card",
        "NetBanking",
        "Wallet",
        "COD",
      ],
      value: methodFilter,
      onChange: setMethodFilter,
    },
    {
      label: "All Status",
      options: ["Captured", "Authorized", "Pending", "Failed"],
      value: statusFilter,
      onChange: setStatusFilter,
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
        title="Payment Gateway & Records"
        subtitle="Gateway authorization status, settlement captures, and payment method performance"
      >
        <Btn
          small
          onClick={() => {
            refetch()
            showToast("Synchronized payment gateway records")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Payments
        </Btn>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="TOTAL PAYMENTS"
          value={stats.totalPayments.toString()}
          sub="All customer checkout attempts"
        />
        <KPICard
          label="CAPTURED VOLUME"
          value={stats.totalVolume}
          sub="Gross settled funds"
          highlight
        />
        <KPICard
          label="CAPTURED / SUCCESS"
          value={stats.captured.toString()}
          sub="Successfully cleared"
        />
        <KPICard
          label="PENDING / TRANSIT"
          value={stats.pending.toString()}
          sub="Awaiting bank callback"
        />
        <KPICard
          label="FAILED ATTEMPTS"
          value={stats.failed.toString()}
          sub="Declined or OTP expired"
        />
      </div>

      {/* Payment Method Distribution Bar */}
      <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#A35E47]" /> Payment Method
            Distribution & Share
          </h3>
          <span className="text-xs text-[#9C9A9A]">
            Real-time customer checkout preferences
          </span>
        </div>
        <div className="grid grid-cols-5 gap-4 pt-2 border-t border-[#E8E8E8]">
          {distribution.map((dist: any) => (
            <div
              key={dist.name}
              className="border-r border-[#E8E8E8] last:border-none pr-3"
            >
              <p className="text-[11px] text-[#9C9A9A] truncate">{dist.name}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-black font-mono-data text-black">
                  {dist.percentage}
                </span>
                <span className="text-xs font-mono-data text-[#9C9A9A]">
                  {dist.volume}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <FilterBar onSearch={setSearch} filters={filtersConfig} />

      {/* Payments Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            <div className="w-6 h-6 border-2 border-[#A35E47] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading payment records from gateways...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            No payment records match the selected criteria.
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(row) => {
              setSelected(row)
              setDrawerOpen(true)
            }}
          />
        )}
      </div>

      {/* Payment Inspection Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ""}
        subtitle={`${selected?.gateway || "Gateway"} · ${selected?.date || "Recent"}`}
        badge={
          selected ? (
            <Badge
              variant={
                selected.status === "Captured"
                  ? "completed"
                  : selected.status === "Failed"
                    ? "failed"
                    : "pending"
              }
              label={selected.status || "Captured"}
              showDot
            />
          ) : null
        }
      >
        {selected && (
          <div className="space-y-6">
            <DrawerSection title="PAYMENT TRANSACTION">
              <DetailRow label="Payment ID" value={selected.id} mono />
              <DetailRow
                label="Associated Order"
                value={selected.orderId || "—"}
                mono
              />
              <DetailRow
                label="Customer Name"
                value={selected.customerName || "—"}
              />
              <DetailRow
                label="Customer Phone"
                value={selected.customerPhone || "—"}
                mono
              />
              <DetailRow
                label="Customer Email"
                value={selected.customerEmail || "—"}
              />
              <DetailRow label="Total Paid" value={selected.amount || "₹0"} />
              <DetailRow
                label="Payment Gateway Fee"
                value={selected.fee || "₹0"}
              />
              <DetailRow
                label="Service Domain"
                value={selected.service || "Food"}
              />
              <DetailRow label="Timestamp" value={selected.date || "—"} />
            </DrawerSection>

            <DrawerSection title="GATEWAY AUDIT & VERIFICATION">
              <DetailRow
                label="Payment Gateway"
                value={selected.gateway || "Razorpay"}
              />
              <DetailRow
                label="Gateway Reference"
                value={selected.gatewayRef || "—"}
                mono
              />
              <DetailRow
                label="Payment Method"
                value={selected.method || "UPI"}
              />
              <DetailRow
                label="Verification Status"
                value={selected.verificationStatus || "Verified"}
              />
              <DetailRow
                label="Authorization Attempts"
                value={selected.attempts?.toString() || "1"}
              />
              {selected.failureReason && (
                <DetailRow
                  label="Failure Reason"
                  value={
                    <span className="text-xs text-[#A35E47] font-semibold">
                      {selected.failureReason}
                    </span>
                  }
                />
              )}
            </DrawerSection>

            <div className="space-y-2 pt-2">
              <Btn
                small
                variant="primary"
                onClick={() => handleVerify(selected.id)}
                disabled={verifyingId === selected.id}
                className="w-full justify-center"
              >
                {verifyingId === selected.id ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                    Querying Gateway...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Re-verify
                    Gateway Status
                  </>
                )}
              </Btn>

              {selected.orderId && onNavigate && (
                <Btn
                  small
                  variant="ghost"
                  onClick={() => {
                    setDrawerOpen(false)
                    onNavigate("orders")
                  }}
                  className="w-full justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View Order #
                  {selected.orderId}
                </Btn>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
