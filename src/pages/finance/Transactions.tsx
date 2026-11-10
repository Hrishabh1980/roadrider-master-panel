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
  ArrowLeftRight,
  Eye,
  ExternalLink,
} from "lucide-react"

export default function Transactions({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [zoneFilter, setZoneFilter] = useState("")
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const {
    data: response,
    loading,
    refetch,
  } = useApi(
    () =>
      financeApi.getTransactions({
        search,
        type: typeFilter,
        status: statusFilter,
        method: methodFilter,
        zone: zoneFilter,
      }),
    {
      data: [],
      total: 0,
      stats: {
        totalCount: 0,
        totalValue: "₹0",
        successfulCount: 0,
        failedCount: 0,
        pendingCount: 0,
      },
    },
    [search, typeFilter, statusFilter, methodFilter, zoneFilter],
  )

  const transactions = response?.data || []
  const stats = response?.stats || {
    totalCount: transactions.length,
    totalValue: "₹0",
    successfulCount: 0,
    failedCount: 0,
    pendingCount: 0,
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Transaction ID,Order ID,Entity,Type,Amount,Platform Fee,Tax,Net Amount,Payment Method,Status,Reference,Date",
      ].join(",") +
      "\n" +
      transactions
        .map(
          (t) =>
            `"${t.id}","${t.orderId || ""}","${t.entity}","${t.type}","${t.amount}","${t.fee}","${t.tax}","${t.net}","${t.method}","${t.status}","${t.ref}","${t.date}"`,
        )
        .join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_transactions_ledger.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Transactions ledger exported to CSV")
  }

  const columns = [
    { key: "id", label: "TXN ID", width: "130px" },
    { key: "orderId", label: "ORDER ID", width: "110px" },
    { key: "entity", label: "CUSTOMER / RECIPIENT" },
    { key: "type", label: "TYPE", width: "130px" },
    { key: "amount", label: "AMOUNT", width: "100px" },
    { key: "fee", label: "FEE", width: "80px" },
    { key: "method", label: "METHOD", width: "90px" },
    { key: "status", label: "STATUS", width: "115px" },
    { key: "date", label: "DATE & TIME", width: "160px" },
    { key: "actions", label: "ACTION", width: "80px" },
  ]

  const rows = transactions.map((t) => ({
    ...t,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {t.id}
      </span>
    ),
    orderId: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">
        {t.orderId || "—"}
      </span>
    ),
    entity: (
      <div>
        <p className="font-semibold text-black text-xs">{t.entity}</p>
        <span className="text-[10px] text-[#9C9A9A] uppercase tracking-wider">
          {t.entityType || "Customer"}
        </span>
      </div>
    ),
    type: (
      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#F5F5F5] text-black">
        {t.type}
      </span>
    ),
    amount: (
      <span className="font-bold font-mono-data text-black">{t.amount}</span>
    ),
    fee: (
      <span className="font-mono-data text-xs text-[#9C9A9A]">
        {t.fee || "₹0"}
      </span>
    ),
    method: (
      <span className="text-xs font-mono-data text-[#464646] font-semibold">
        {t.method}
      </span>
    ),
    status: (
      <Badge
        variant={t.status?.toLowerCase() || "completed"}
        label={t.status || "Completed"}
        showDot
      />
    ),
    date: <span className="text-xs text-[#464646]">{t.date}</span>,
    actions: (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setSelected(t)
          setDrawerOpen(true)
        }}
        className="text-xs text-[#A35E47] font-semibold hover:underline inline-flex items-center gap-1"
      >
        <Eye className="w-3.5 h-3.5" /> Details
      </button>
    ),
  }))

  const filtersConfig = [
    {
      label: "All Types",
      options: [
        "Order Payment",
        "Vendor Payout",
        "Partner Payout",
        "Wallet Topup",
        "Refund",
      ],
      value: typeFilter,
      onChange: setTypeFilter,
    },
    {
      label: "All Status",
      options: ["Completed", "Pending", "Failed", "Refunded"],
      value: statusFilter,
      onChange: setStatusFilter,
    },
    {
      label: "All Methods",
      options: ["UPI", "Card", "NetBanking", "Wallet", "Cash", "IMPS", "NEFT"],
      value: methodFilter,
      onChange: setMethodFilter,
    },
    {
      label: "All Zones",
      options: [
        "Gomti Nagar",
        "Hazratganj",
        "Aliganj",
        "Indira Nagar",
        "Alambagh",
      ],
      value: zoneFilter,
      onChange: setZoneFilter,
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
        title="Transactions Ledger"
        subtitle="Real-time financial transactions, customer debits, partner credits, and refunds"
      >
        <Btn
          small
          onClick={() => {
            refetch()
            showToast("Refreshed transactions from database")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
        </Btn>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="TOTAL TRANSACTIONS"
          value={stats.totalCount.toString()}
          sub="All recorded ledger events"
        />
        <KPICard
          label="TRANSACTION VALUE"
          value={stats.totalValue}
          sub="Total monetary flow"
          highlight
        />
        <KPICard
          label="SUCCESSFUL"
          value={stats.successfulCount.toString()}
          sub="Settled and cleared"
        />
        <KPICard
          label="PENDING"
          value={stats.pendingCount.toString()}
          sub="In banking transit"
        />
        <KPICard
          label="FAILED / REFUNDED"
          value={stats.failedCount.toString()}
          sub="Disputed or dropped"
        />
      </div>

      {/* Filters and Search Bar */}
      <FilterBar onSearch={setSearch} filters={filtersConfig} />

      {/* Transactions Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            <div className="w-6 h-6 border-2 border-[#A35E47] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading transactions from financial ledger...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            No transactions match the selected filters.
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

      {/* Transaction Details Drawer */}
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
          <div className="space-y-6">
            <DrawerSection title="TRANSACTION SUMMARY">
              <DetailRow label="Transaction ID" value={selected.id} mono />
              <DetailRow
                label="Associated Order"
                value={selected.orderId || "—"}
                mono
              />
              <DetailRow
                label="Customer / Recipient"
                value={selected.entity || "—"}
              />
              <DetailRow
                label="Account Type"
                value={selected.entityType || "Customer"}
              />
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
                label="Net Transfer"
                value={selected.net || selected.amount || "₹0"}
              />
            </DrawerSection>

            <DrawerSection title="GATEWAY & ROUTING">
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
                label="Operating Zone"
                value={selected.zone || "Lucknow Central"}
              />
              <DetailRow
                label="Service Line"
                value={selected.service || "Food Delivery"}
              />
              <DetailRow label="Timestamp" value={selected.date || "—"} />
              <DetailRow
                label="Settlement State"
                value={
                  <Badge
                    variant={selected.status?.toLowerCase() || "completed"}
                    label={selected.status || "Completed"}
                    showDot
                  />
                }
              />
            </DrawerSection>

            {selected.orderId && onNavigate && (
              <div className="pt-2">
                <Btn
                  small
                  variant="primary"
                  onClick={() => {
                    setDrawerOpen(false)
                    onNavigate("orders")
                  }}
                  className="w-full justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View Order in
                  Operations
                </Btn>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
