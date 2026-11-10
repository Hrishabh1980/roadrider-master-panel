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
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Scale,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"

export default function Reconciliation({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [activeTab, setActiveTab] = useState("Discrepancy Queue")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [resolveModalItem, setResolveModalItem] = useState<any | null>(null)
  const [resolutionType, setResolutionType] = useState(
    "Fee Adjustment Approved",
  )
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [reconciling, setReconciling] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const {
    data: response,
    loading,
    refetch,
  } = useApi(
    () => financeApi.getReconciliation({ search }),
    {
      stats: {
        totalAudited: 0,
        matchedCount: 0,
        matchedRate: "100%",
        discrepancyCount: 0,
        discrepancyAmount: "₹0",
        settlementStatus: "Balanced",
      },
      discrepancies: [],
      matchedLedger: [],
      settlementBatches: [],
    },
    [search],
  )

  const stats = response?.stats || {
    totalAudited: 1428,
    matchedCount: 1425,
    matchedRate: "99.8%",
    discrepancyCount: 0,
    discrepancyAmount: "₹0",
    settlementStatus: "Balanced",
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleRunReconciliation = async () => {
    setReconciling(true)
    try {
      const res = await financeApi.triggerReconciliation()
      showToast(res.message)
      refetch()
    } catch {
      showToast("Reconciliation run encountered an error.")
    } finally {
      setReconciling(false)
    }
  }

  const handleResolve = async () => {
    if (!resolveModalItem) return
    setResolving(true)
    try {
      const res = await financeApi.resolveDiscrepancy(resolveModalItem.id, {
        resolution: resolutionType,
        notes: resolutionNotes,
      })
      showToast(res.message)
      setResolveModalItem(null)
      setResolutionNotes("")
      refetch()
    } catch {
      showToast("Failed to resolve discrepancy.")
    } finally {
      setResolving(false)
    }
  }

  const handleExport = () => {
    const list = response?.discrepancies || []
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Audit ID,Internal TXN,Gateway Ref,Internal Amt,Gateway Amt,Difference,Type,Status,Gateway,Date",
      ].join(",") +
      "\n" +
      list
        .map(
          (d: any) =>
            `"${d.id}","${d.transactionRef}","${d.gatewayRef}","${d.internalAmount}","${d.gatewayAmount}","${d.difference}","${d.type}","${d.status}","${d.gatewayName}","${d.date}"`,
        )
        .join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_reconciliation_audit.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Reconciliation audit log exported to CSV")
  }

  const tabs = ["Discrepancy Queue", "Matched Ledger", "Settlement Batches"]

  // Columns for Discrepancy Queue
  const discrepancyColumns = [
    { key: "id", label: "AUDIT ID", width: "100px" },
    { key: "transactionRef", label: "INTERNAL TXN", width: "140px" },
    { key: "gatewayRef", label: "GATEWAY REF", width: "150px" },
    { key: "internalAmount", label: "RECORDED", width: "100px" },
    { key: "gatewayAmount", label: "GATEWAY SETTLED", width: "130px" },
    { key: "difference", label: "DIFFERENCE", width: "110px" },
    { key: "type", label: "DISCREPANCY TYPE" },
    { key: "status", label: "STATUS", width: "120px" },
    { key: "actions", label: "ACTIONS", width: "120px" },
  ]

  const discrepancyRows = (response?.discrepancies || []).map((d: any) => ({
    ...d,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {d.id}
      </span>
    ),
    transactionRef: (
      <span className="text-xs font-mono-data text-black font-semibold">
        {d.transactionRef}
      </span>
    ),
    gatewayRef: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">
        {d.gatewayRef}
      </span>
    ),
    internalAmount: (
      <span className="font-mono-data text-xs text-black">
        {d.internalAmount}
      </span>
    ),
    gatewayAmount: (
      <span className="font-mono-data text-xs text-[#9C9A9A]">
        {d.gatewayAmount}
      </span>
    ),
    difference: (
      <span
        className={`font-mono-data text-xs font-bold ${
          d.differenceNum > 0 ? "text-[#A35E47]" : "text-green-600"
        }`}
      >
        {d.difference}
      </span>
    ),
    type: (
      <div>
        <p className="text-xs font-semibold text-black">{d.type}</p>
        <p className="text-[10px] text-[#9C9A9A]">{d.gatewayName}</p>
      </div>
    ),
    status: (
      <Badge
        variant={
          d.status === "Resolved"
            ? "completed"
            : d.status === "Discrepancy"
              ? "failed"
              : "pending"
        }
        label={d.status}
        showDot
      />
    ),
    actions: (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {d.status !== "Resolved" && (
          <button
            onClick={() => setResolveModalItem(d)}
            className="text-[11px] font-semibold text-white bg-black hover:bg-[#464646] px-2 py-1 rounded transition-colors"
          >
            Resolve
          </button>
        )}
        <button
          onClick={() => {
            setSelected(d)
            setDrawerOpen(true)
          }}
          className="text-xs text-[#9C9A9A] hover:text-black font-semibold px-1 py-1"
        >
          Inspect
        </button>
      </div>
    ),
  }))

  // Columns for Matched Ledger
  const matchedColumns = [
    { key: "id", label: "AUDIT ID", width: "110px" },
    { key: "transactionRef", label: "INTERNAL TXN", width: "140px" },
    { key: "gatewayRef", label: "GATEWAY REF", width: "160px" },
    { key: "internalAmount", label: "INTERNAL AMOUNT", width: "130px" },
    { key: "gatewayAmount", label: "GATEWAY AMOUNT", width: "130px" },
    { key: "gatewayName", label: "GATEWAY CHANNEL" },
    { key: "status", label: "STATUS", width: "120px" },
    { key: "date", label: "SETTLED DATE", width: "130px" },
  ]

  const matchedRows = (response?.matchedLedger || []).map((m: any) => ({
    ...m,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {m.id}
      </span>
    ),
    transactionRef: (
      <span className="text-xs font-mono-data text-black font-semibold">
        {m.transactionRef}
      </span>
    ),
    gatewayRef: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">
        {m.gatewayRef}
      </span>
    ),
    internalAmount: (
      <span className="font-mono-data text-xs text-black">
        {m.internalAmount}
      </span>
    ),
    gatewayAmount: (
      <span className="font-mono-data text-xs text-black">
        {m.gatewayAmount}
      </span>
    ),
    gatewayName: (
      <span className="text-xs font-medium text-[#464646]">
        {m.gatewayName}
      </span>
    ),
    status: <Badge variant="completed" label="Matched" showDot />,
    date: <span className="text-xs text-[#464646]">{m.date}</span>,
  }))

  // Columns for Settlement Batches
  const batchColumns = [
    { key: "batchId", label: "BATCH ID", width: "180px" },
    { key: "gateway", label: "GATEWAY / BANK", width: "140px" },
    { key: "totalVolume", label: "GROSS VOLUME", width: "130px" },
    { key: "deductions", label: "MDR / CHARGES", width: "120px" },
    { key: "netSettlement", label: "NET ESCROW DEPOSIT", width: "150px" },
    { key: "status", label: "SETTLEMENT STATE", width: "140px" },
    { key: "settlementDate", label: "SETTLEMENT DATE", width: "160px" },
    { key: "bankUtr", label: "BANK UTR REF" },
  ]

  const batchRows = (response?.settlementBatches || []).map((b: any) => ({
    ...b,
    batchId: (
      <span className="text-xs font-mono-data font-bold text-black">
        {b.batchId}
      </span>
    ),
    gateway: (
      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F5F5F5] text-black">
        {b.gateway}
      </span>
    ),
    totalVolume: (
      <span className="font-mono-data text-xs text-black">{b.totalVolume}</span>
    ),
    deductions: (
      <span className="font-mono-data text-xs text-[#A35E47]">
        {b.deductions}
      </span>
    ),
    netSettlement: (
      <span className="font-bold font-mono-data text-black">
        {b.netSettlement}
      </span>
    ),
    status: <Badge variant="completed" label={b.status} showDot />,
    settlementDate: (
      <span className="text-xs text-[#464646]">{b.settlementDate}</span>
    ),
    bankUtr: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">{b.bankUtr}</span>
    ),
  }))

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader
        title="Financial Reconciliation"
        subtitle="Gateway settlement verification, ledger matching, and discrepancy audit"
      >
        <Btn
          small
          variant="primary"
          onClick={handleRunReconciliation}
          disabled={reconciling}
        >
          {reconciling ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
              Reconciling Feeds...
            </>
          ) : (
            <>
              <Scale className="w-3.5 h-3.5 mr-1" /> Run Auto-Reconciliation
            </>
          )}
        </Btn>
        <Btn
          small
          onClick={() => {
            refetch()
            showToast("Refreshed audit records")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Audit Log
        </Btn>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="TOTAL AUDITED RECORDS"
          value={stats.totalAudited.toLocaleString()}
          sub="Order & transfer events"
        />
        <KPICard
          label="MATCHED TRANSACTIONS"
          value={stats.matchedCount.toLocaleString()}
          sub={`${stats.matchedRate} match rate`}
        />
        <KPICard
          label="DISCREPANCIES IDENTIFIED"
          value={stats.discrepancyCount.toString()}
          sub="Requiring manual audit"
          highlight={stats.discrepancyCount > 0}
        />
        <KPICard
          label="UNMATCHED AMOUNT"
          value={stats.discrepancyAmount}
          sub="Total pending delta"
          highlight={stats.discrepancyCount > 0}
        />
        <KPICard
          label="ESCROW SETTLEMENT"
          value={stats.settlementStatus}
          sub="Acquiring bank feeds"
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Filter and Search */}
      <FilterBar onSearch={setSearch} />

      {/* Tables based on active tab */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            <div className="w-6 h-6 border-2 border-[#A35E47] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading reconciliation audit data...
          </div>
        ) : activeTab === "Discrepancy Queue" ? (
          discrepancyRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-green-700 bg-[#F0FDF4]">
              ✓ All recorded database transactions and settlements are balanced
              with zero discrepancies.
            </div>
          ) : (
            <DataTable
              columns={discrepancyColumns}
              rows={discrepancyRows}
              onRowClick={(row) => {
                setSelected(row)
                setDrawerOpen(true)
              }}
            />
          )
        ) : activeTab === "Matched Ledger" ? (
          <DataTable columns={matchedColumns} rows={matchedRows} />
        ) : (
          <DataTable columns={batchColumns} rows={batchRows} />
        )}
      </div>

      {/* Resolve Discrepancy Modal */}
      {resolveModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E8E8] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#FFF8F0] text-[#A35E47]">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">
                    Resolve Ledger Discrepancy
                  </h3>
                  <p className="text-xs text-[#9C9A9A] font-mono-data">
                    {resolveModalItem.id} · {resolveModalItem.transactionRef}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResolveModalItem(null)}
                className="text-[#9C9A9A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F9F9F9] rounded-lg mb-4 text-xs space-y-1.5 border border-[#E8E8E8]">
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Discrepancy Type:</span>
                <span className="font-semibold text-black">
                  {resolveModalItem.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Internal Database:</span>
                <span className="font-mono-data text-black">
                  {resolveModalItem.internalAmount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Gateway Settled:</span>
                <span className="font-mono-data text-black">
                  {resolveModalItem.gatewayAmount}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#E8E8E8]">
                <span className="font-bold text-black">Net Delta:</span>
                <span className="font-bold text-[#A35E47] font-mono-data">
                  {resolveModalItem.difference}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Resolution Strategy
                </label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] bg-white outline-none focus:border-black"
                >
                  <option value="Fee Adjustment Approved">
                    Fee Adjustment Approved (Gateway Commission Write-Off)
                  </option>
                  <option value="Manual Bank Clearance Confirmed">
                    Manual Bank Clearance Confirmed via Offline UTR
                  </option>
                  <option value="Chargeback Contest Submitted">
                    Chargeback Contest Documentation Submitted to Bank
                  </option>
                  <option value="Force Balanced into Escrow">
                    Force Balanced into General Ledger Adjustment Account
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Administrative Audit Remarks
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record resolution rationale for statutory finance audits..."
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn
                small
                variant="ghost"
                onClick={() => setResolveModalItem(null)}
              >
                Cancel
              </Btn>
              <Btn
                small
                variant="primary"
                onClick={handleResolve}
                disabled={resolving}
              >
                {resolving ? "Applying..." : "Mark Discrepancy Resolved"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Details Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ""}
        subtitle={`${selected?.type || "Discrepancy"} · ${selected?.transactionRef}`}
        badge={
          selected ? (
            <Badge
              variant={selected.status === "Resolved" ? "completed" : "failed"}
              label={selected.status || "Discrepancy"}
              showDot
            />
          ) : null
        }
      >
        {selected && (
          <div className="space-y-6">
            <DrawerSection title="DISCREPANCY COMPARISON">
              <DetailRow label="Audit ID" value={selected.id} mono />
              <DetailRow
                label="Internal TXN Ref"
                value={selected.transactionRef}
                mono
              />
              <DetailRow
                label="Gateway Transaction ID"
                value={selected.gatewayRef}
                mono
              />
              <DetailRow label="Payment Gateway" value={selected.gatewayName} />
              <DetailRow
                label="Internal Amount"
                value={selected.internalAmount}
              />
              <DetailRow
                label="Gateway Reported Amount"
                value={selected.gatewayAmount}
              />
              <DetailRow
                label="Amount Delta"
                value={
                  <span className="font-bold text-[#A35E47] font-mono-data">
                    {selected.difference}
                  </span>
                }
              />
              <DetailRow label="Audit Date" value={selected.date} />
            </DrawerSection>

            <DrawerSection title="AUDIT FINDINGS & CONTEXT">
              <div className="p-3 bg-[#F9F9F9] rounded-lg text-xs border border-[#E8E8E8] text-[#464646]">
                <p className="font-bold text-black mb-1">
                  Automated System Diagnostics:
                </p>
                <p>
                  {selected.notes ||
                    "Discrepancy flagged by automated batch reconciliation run."}
                </p>
              </div>
            </DrawerSection>

            {selected.status !== "Resolved" && (
              <div className="pt-2">
                <Btn
                  small
                  variant="primary"
                  onClick={() => {
                    setDrawerOpen(false)
                    setResolveModalItem(selected)
                  }}
                  className="w-full justify-center"
                >
                  <Scale className="w-3.5 h-3.5 mr-1.5" /> Resolve Discrepancy
                </Btn>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
