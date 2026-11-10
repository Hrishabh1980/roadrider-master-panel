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
  Tabs,
  KPICard,
} from "../../components/ui"
import { useApi } from "../../hooks/useApi"
import { financeApi } from "../../services/api"
import {
  Download,
  RefreshCw,
  Check,
  X,
  DollarSign,
  Send,
  Building2,
  User,
  Eye,
  AlertCircle,
  ShieldCheck,
} from "lucide-react"

export default function Payouts({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [activeTab, setActiveTab] = useState("All Payouts")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [processModalItem, setProcessModalItem] = useState<any | null>(null)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const {
    data: response,
    loading,
    refetch,
  } = useApi(
    () =>
      financeApi.getPayouts({
        search,
        status: statusFilter,
        recipientType:
          activeTab === "Rider Payouts"
            ? "Rider"
            : activeTab === "Vendor Payouts"
              ? "Vendor"
              : undefined,
      }),
    {
      data: [],
      total: 0,
      riders: [],
      vendors: [],
      stats: {
        totalPayoutAmount: "₹0",
        pendingPayouts: "₹0",
        pendingCount: 0,
        completedCount: 0,
        failedCount: 0,
        availableBalance: "₹0",
      },
    },
    [search, statusFilter, activeTab],
  )

  const stats = response?.stats || {
    totalPayoutAmount: "₹0",
    pendingPayouts: "₹0",
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    availableBalance: "₹340,500",
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleProcessPayout = async () => {
    if (!processModalItem) return
    setProcessing(true)
    try {
      const res = await financeApi.processPayout(processModalItem.id)
      showToast(res.message)
      setProcessModalItem(null)
      refetch()
    } catch {
      showToast("Error processing payout disbursement.")
    } finally {
      setProcessing(false)
    }
  }

  const handleExport = () => {
    const list = response?.data || []
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Payout ID,Recipient,Type,Account/Bank,Amount,Fee Deducted,Net Payout,Status,Scheduled Date,UTR",
      ].join(",") +
      "\n" +
      list
        .map(
          (p: any) =>
            `"${p.id}","${p.recipientName}","${p.recipientType}","${p.maskedAccount}","${p.amount}","${p.platformFeeDeducted}","${p.netPayout}","${p.status}","${p.scheduledDate}","${p.utrRef}"`,
        )
        .join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_payouts_disbursements.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Payout disbursements exported to CSV")
  }

  const tabs = ["All Payouts", "Rider Payouts", "Vendor Payouts"]

  let currentList: any[] = []
  if (activeTab === "Rider Payouts") {
    currentList = response?.riders || []
  } else if (activeTab === "Vendor Payouts") {
    currentList = response?.vendors || []
  } else {
    currentList = response?.data || []
  }

  const columns = [
    { key: "id", label: "PAYOUT ID", width: "120px" },
    { key: "recipientName", label: "RECIPIENT & PROFILE" },
    { key: "recipientType", label: "TYPE", width: "110px" },
    { key: "maskedAccount", label: "BANK / UPI DETAILS", width: "180px" },
    { key: "amount", label: "GROSS", width: "100px" },
    { key: "netPayout", label: "NET PAYOUT", width: "110px" },
    { key: "scheduledDate", label: "SCHEDULED DATE", width: "130px" },
    { key: "status", label: "STATUS", width: "115px" },
    { key: "utrRef", label: "PAYMENT REF / UTR", width: "150px" },
    { key: "actions", label: "ACTIONS", width: "110px" },
  ]

  const rows = currentList.map((p) => ({
    ...p,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {p.id}
      </span>
    ),
    recipientName: (
      <div className="flex items-center gap-2">
        <div className="p-1 rounded bg-[#F5F5F5] text-[#464646]">
          {p.recipientType === "Vendor" ? (
            <Building2 className="w-3.5 h-3.5" />
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
        </div>
        <div>
          <p className="font-semibold text-black text-xs">{p.recipientName}</p>
          <p className="text-[10px] text-[#9C9A9A]">
            {p.cyclePeriod || "Current Billing Cycle"}
          </p>
        </div>
      </div>
    ),
    recipientType: (
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
          p.recipientType === "Vendor"
            ? "bg-[#FFF8F0] text-[#A35E47]"
            : "bg-[#F5F5F5] text-black"
        }`}
      >
        {p.recipientType}
      </span>
    ),
    maskedAccount: (
      <div>
        <p className="text-xs font-mono-data font-semibold text-black">
          {p.maskedAccount}
        </p>
        <p className="text-[10px] text-[#9C9A9A] font-mono-data">
          {p.ifscMasked || p.bankName}
        </p>
      </div>
    ),
    amount: (
      <span className="font-mono-data text-xs text-[#9C9A9A]">{p.amount}</span>
    ),
    netPayout: (
      <span className="font-bold font-mono-data text-black">{p.netPayout}</span>
    ),
    scheduledDate: (
      <span className="text-xs text-[#464646]">{p.scheduledDate}</span>
    ),
    status: (
      <Badge
        variant={
          p.status === "Completed"
            ? "completed"
            : p.status === "Failed"
              ? "failed"
              : p.status === "Processing"
                ? "inprogress"
                : "pending"
        }
        label={p.status}
        showDot
      />
    ),
    utrRef: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">{p.utrRef}</span>
    ),
    actions: (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {p.status === "Pending" && (
          <button
            onClick={() => setProcessModalItem(p)}
            className="text-[11px] font-semibold text-white bg-black hover:bg-[#464646] px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> Disburse
          </button>
        )}
        <button
          onClick={() => {
            setSelected(p)
            setDrawerOpen(true)
          }}
          className="text-xs text-[#9C9A9A] hover:text-black font-semibold p-1"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    ),
  }))

  const filtersConfig = [
    {
      label: "All Status",
      options: ["Pending", "Processing", "Completed", "Failed"],
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
        title="Partner & Vendor Payouts"
        subtitle="Automated disbursement queue, bank transfers, and recipient settlement cycles"
      >
        <Btn
          small
          onClick={() => {
            refetch()
            showToast("Refreshed payout ledger")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Payouts
        </Btn>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="TOTAL PAYOUT VOLUME"
          value={stats.totalPayoutAmount}
          sub="Gross partner allocations"
        />
        <KPICard
          label="PENDING DISBURSEMENTS"
          value={stats.pendingPayouts}
          sub={`${stats.pendingCount} queued batches`}
          highlight
        />
        <KPICard
          label="COMPLETED PAYOUTS"
          value={stats.completedCount.toString()}
          sub="Settled to bank accounts"
        />
        <KPICard
          label="FAILED / REVERSED"
          value={stats.failedCount.toString()}
          sub="Requires bank detail check"
        />
        <KPICard
          label="AVAILABLE ESCROW BALANCE"
          value={stats.availableBalance}
          sub="Disbursable floating capital"
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Filters and Search Bar */}
      <FilterBar onSearch={setSearch} filters={filtersConfig} />

      {/* Payouts Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            <div className="w-6 h-6 border-2 border-[#A35E47] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading payout disbursement schedule...
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            No payout disbursements logged under {activeTab}.
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

      {/* Process Payout Modal */}
      {processModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E8E8] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#FFF8F0] text-[#A35E47]">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">
                    Authorize Payout Disbursement
                  </h3>
                  <p className="text-xs text-[#9C9A9A] font-mono-data">
                    {processModalItem.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProcessModalItem(null)}
                className="text-[#9C9A9A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F9F9F9] rounded-lg mb-4 text-xs space-y-1.5 border border-[#E8E8E8]">
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Recipient:</span>
                <span className="font-semibold text-black">
                  {processModalItem.recipientName} (
                  {processModalItem.recipientType})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Bank Account:</span>
                <span className="font-mono-data font-semibold text-black">
                  {processModalItem.maskedAccount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Gross Earnings:</span>
                <span className="font-mono-data text-black">
                  {processModalItem.amount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Fee Deductions:</span>
                <span className="font-mono-data text-[#A35E47]">
                  {processModalItem.platformFeeDeducted}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#E8E8E8]">
                <span className="font-bold text-black">
                  Net Disbursement Amount:
                </span>
                <span className="font-black text-black font-mono-data text-sm">
                  {processModalItem.netPayout}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p>
                This action commits the settlement batch to the banking partner
                switch. A genuine UTR transaction reference will be logged upon
                clearance.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn
                small
                variant="ghost"
                onClick={() => setProcessModalItem(null)}
              >
                Cancel
              </Btn>
              <Btn
                small
                variant="primary"
                onClick={handleProcessPayout}
                disabled={processing}
              >
                {processing
                  ? "Connecting Gateway..."
                  : "Approve & Disburse Batch"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Payout Details Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ""}
        subtitle={`${selected?.recipientType || "Partner"} · ${selected?.recipientName || "Recipient"}`}
        badge={
          selected ? (
            <Badge
              variant={
                selected.status === "Completed"
                  ? "completed"
                  : selected.status === "Failed"
                    ? "failed"
                    : "pending"
              }
              label={selected.status || "Pending"}
              showDot
            />
          ) : null
        }
      >
        {selected && (
          <div className="space-y-6">
            <DrawerSection title="PAYOUT SUMMARY">
              <DetailRow label="Payout ID" value={selected.id} mono />
              <DetailRow
                label="Recipient Name"
                value={selected.recipientName}
              />
              <DetailRow
                label="Recipient Category"
                value={selected.recipientType}
              />
              <DetailRow
                label="Billing Cycle"
                value={selected.cyclePeriod || "15 Oct – 21 Oct 2026"}
              />
              <DetailRow
                label="Scheduled Date"
                value={selected.scheduledDate}
              />
              {selected.disbursedDate && (
                <DetailRow
                  label="Disbursed Timestamp"
                  value={selected.disbursedDate}
                />
              )}
            </DrawerSection>

            <DrawerSection title="FINANCIAL BREAKDOWN">
              <DetailRow label="Gross Earnings" value={selected.amount} />
              <DetailRow
                label="Platform Commission Deducted"
                value={selected.platformFeeDeducted}
              />
              <DetailRow
                label="Net Disbursable Payout"
                value={
                  <span className="font-bold text-black font-mono-data text-sm">
                    {selected.netPayout}
                  </span>
                }
              />
            </DrawerSection>

            <DrawerSection title="BANKING & SETTLEMENT">
              <DetailRow label="Bank Name" value={selected.bankName} />
              <DetailRow
                label="Beneficiary Account"
                value={selected.maskedAccount}
                mono
              />
              <DetailRow
                label="Bank IFSC"
                value={selected.ifscMasked || "HDFC000••••"}
                mono
              />
              <DetailRow
                label="Settlement UTR Ref"
                value={selected.utrRef || "Pending Release"}
                mono
              />
              <DetailRow
                label="Disbursement Status"
                value={
                  <Badge
                    variant={
                      selected.status === "Completed"
                        ? "completed"
                        : selected.status === "Failed"
                          ? "failed"
                          : "pending"
                    }
                    label={selected.status || "Pending"}
                    showDot
                  />
                }
              />
            </DrawerSection>

            {selected.status === "Pending" && (
              <div className="pt-2">
                <Btn
                  small
                  variant="primary"
                  onClick={() => {
                    setDrawerOpen(false)
                    setProcessModalItem(selected)
                  }}
                  className="w-full justify-center"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Disburse Payout
                </Btn>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
