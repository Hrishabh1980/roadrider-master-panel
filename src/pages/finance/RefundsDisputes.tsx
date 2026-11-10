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
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ExternalLink,
} from "lucide-react"

export default function RefundsDisputes({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [activeTab, setActiveTab] = useState("Refund Requests")
  const [search, setSearch] = useState("")
  const [reasonFilter, setReasonFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [approveModalItem, setApproveModalItem] = useState<any | null>(null)
  const [rejectModalItem, setRejectModalItem] = useState<any | null>(null)
  const [refundMethod, setRefundMethod] = useState(
    "Original Source (UPI / Card)",
  )
  const [rejectionReason, setRejectionReason] = useState(
    "Request filed beyond standard return SLA window",
  )
  const [adminNotes, setAdminNotes] = useState("")
  const [toast, setToast] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const {
    data: response,
    loading,
    refetch,
  } = useApi(
    () =>
      financeApi.getRefunds({
        search,
        reason: reasonFilter,
        status: statusFilter,
      }),
    {
      data: [],
      total: 0,
      requests: [],
      disputes: [],
      history: [],
      stats: {
        totalRequests: 0,
        totalRefundedAmount: "₹0",
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      },
    },
    [search, reasonFilter, statusFilter],
  )

  const stats = response?.stats || {
    totalRequests: 0,
    totalRefundedAmount: "₹0",
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleApprove = async () => {
    if (!approveModalItem) return
    setProcessing(true)
    try {
      const res = await financeApi.approveRefund(approveModalItem.id, {
        refundMethod,
        notes: adminNotes,
      })
      showToast(res.message)
      setApproveModalItem(null)
      setAdminNotes("")
      refetch()
    } catch {
      showToast("Failed to approve refund.")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectModalItem) return
    setProcessing(true)
    try {
      const res = await financeApi.rejectRefund(rejectModalItem.id, {
        reason: rejectionReason,
        notes: adminNotes,
      })
      showToast(res.message)
      setRejectModalItem(null)
      setAdminNotes("")
      refetch()
    } catch {
      showToast("Failed to reject refund.")
    } finally {
      setProcessing(false)
    }
  }

  const handleExport = () => {
    const list = response?.data || []
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Refund ID,Order ID,Customer,Amount,Reason,Type,Status,Assigned Admin,Date",
      ].join(",") +
      "\n" +
      list
        .map(
          (r: any) =>
            `"${r.id}","${r.orderId}","${r.customerName}","${r.amount}","${r.reason}","${r.type}","${r.status}","${r.assignedAdmin}","${r.requestedDate}"`,
        )
        .join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_refunds_and_disputes.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Refund and dispute records exported")
  }

  const tabs = ["Refund Requests", "Disputes", "Refund History"]

  // Current records based on activeTab
  let currentList: any[] = []
  if (activeTab === "Refund Requests") {
    currentList = response?.requests || []
  } else if (activeTab === "Disputes") {
    currentList = response?.disputes || []
  } else {
    currentList = response?.history || []
  }

  const columns = [
    { key: "id", label: "REFUND ID", width: "120px" },
    { key: "orderId", label: "ORDER ID", width: "110px" },
    { key: "customerName", label: "CUSTOMER" },
    { key: "amount", label: "REFUND AMOUNT", width: "120px" },
    { key: "reason", label: "REASON & CLAIM" },
    { key: "requestedDate", label: "REQUEST DATE", width: "150px" },
    { key: "status", label: "STATUS", width: "120px" },
    { key: "assignedAdmin", label: "ASSIGNED REVIEWER", width: "160px" },
    { key: "actions", label: "ACTIONS", width: "180px" },
  ]

  const rows = currentList.map((r) => ({
    ...r,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {r.id}
      </span>
    ),
    orderId: (
      <span className="text-xs font-mono-data text-[#9C9A9A]">{r.orderId}</span>
    ),
    customerName: (
      <div>
        <p className="font-semibold text-black text-xs">{r.customerName}</p>
        <p className="text-[10px] text-[#9C9A9A]">{r.customerPhone || ""}</p>
      </div>
    ),
    amount: (
      <span className="font-bold font-mono-data text-black">{r.amount}</span>
    ),
    reason: (
      <span className="text-xs text-[#464646] line-clamp-1" title={r.reason}>
        {r.reason}
      </span>
    ),
    requestedDate: (
      <span className="text-xs text-[#464646]">{r.requestedDate}</span>
    ),
    status: (
      <Badge
        variant={
          r.status === "Approved"
            ? "completed"
            : r.status === "Rejected"
              ? "failed"
              : r.status === "Under Review"
                ? "inprogress"
                : "pending"
        }
        label={r.status}
        showDot
      />
    ),
    assignedAdmin: (
      <span className="text-xs text-[#464646]">{r.assignedAdmin}</span>
    ),
    actions: (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {r.status === "Pending" || r.status === "Under Review" ? (
          <>
            <button
              onClick={() => setApproveModalItem(r)}
              className="text-[11px] font-semibold text-white bg-black hover:bg-[#464646] px-2.5 py-1 rounded transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => setRejectModalItem(r)}
              className="text-[11px] font-semibold text-white bg-[#A35E47] hover:opacity-90 px-2.5 py-1 rounded transition-opacity"
            >
              Reject
            </button>
          </>
        ) : null}
        <button
          onClick={() => {
            setSelected(r)
            setDrawerOpen(true)
          }}
          className="text-xs text-[#9C9A9A] hover:text-black font-semibold px-1 py-1"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    ),
  }))

  const filtersConfig = [
    {
      label: "All Reasons",
      options: [
        "Order cancelled",
        "Missing item",
        "Driver no-show",
        "Quality issue",
        "Chargeback claim",
        "Overcharged",
      ],
      value: reasonFilter,
      onChange: setReasonFilter,
    },
    {
      label: "All Status",
      options: ["Pending", "Under Review", "Approved", "Rejected"],
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
        title="Refunds & Disputes"
        subtitle="Manage customer refund requests, dispute arbitrations, and chargeback claims"
      >
        <Btn
          small
          onClick={() => {
            refetch()
            showToast("Refreshed refund queue")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Queue
        </Btn>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="TOTAL REFUND REQUESTS"
          value={stats.totalRequests.toString()}
          sub="All recorded claims"
        />
        <KPICard
          label="PENDING REVIEW"
          value={stats.pendingCount.toString()}
          sub="Requiring action"
          highlight
        />
        <KPICard
          label="APPROVED"
          value={stats.approvedCount.toString()}
          sub="Settled refunds"
        />
        <KPICard
          label="REJECTED / CLOSED"
          value={stats.rejectedCount.toString()}
          sub="Denied claims"
        />
        <KPICard
          label="TOTAL REFUNDED AMOUNT"
          value={stats.totalRefundedAmount}
          sub="Processed capital"
        />
      </div>

      {/* Segment Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Filters and Search Bar */}
      <FilterBar onSearch={setSearch} filters={filtersConfig} />

      {/* Refunds Table */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            <div className="w-6 h-6 border-2 border-[#A35E47] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading refund records...
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            No records found under {activeTab}.
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

      {/* Approve Refund Modal */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E8E8] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#F0FDF4] text-green-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">
                    Approve Refund
                  </h3>
                  <p className="text-xs text-[#9C9A9A] font-mono-data">
                    {approveModalItem.id} · Order #{approveModalItem.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApproveModalItem(null)}
                className="text-[#9C9A9A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F9F9F9] rounded-lg mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Customer:</span>
                <span className="font-semibold text-black">
                  {approveModalItem.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Refund Amount:</span>
                <span className="font-bold text-black font-mono-data text-sm">
                  {approveModalItem.amount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Claim Reason:</span>
                <span className="text-[#464646] font-medium text-right">
                  {approveModalItem.reason}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Refund Method Destination
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] bg-white outline-none focus:border-black"
                >
                  <option value="Original Source (UPI / Card)">
                    Original Payment Source (Bank / UPI / Card)
                  </option>
                  <option value="RoadRider Wallet (Instant Credit)">
                    RoadRider Digital Wallet (Instant Credit)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Approval Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Enter internal audit note or authorization reference..."
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn
                small
                variant="ghost"
                onClick={() => setApproveModalItem(null)}
              >
                Cancel
              </Btn>
              <Btn
                small
                variant="primary"
                onClick={handleApprove}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm & Process Refund"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Reject Refund Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E8E8] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#FEF2F2] text-[#A35E47]">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">
                    Reject Refund Claim
                  </h3>
                  <p className="text-xs text-[#9C9A9A] font-mono-data">
                    {rejectModalItem.id} · Order #{rejectModalItem.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectModalItem(null)}
                className="text-[#9C9A9A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F9F9F9] rounded-lg mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Customer:</span>
                <span className="font-semibold text-black">
                  {rejectModalItem.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9A9A]">Claimed Amount:</span>
                <span className="font-bold text-black font-mono-data">
                  {rejectModalItem.amount}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Select Rejection Reason{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] bg-white outline-none focus:border-black"
                >
                  <option value="Request filed beyond standard return SLA window">
                    Request filed beyond standard return SLA window (45 min)
                  </option>
                  <option value="Merchant provided valid delivery handover OTP and image">
                    Merchant provided valid delivery handover OTP and image
                  </option>
                  <option value="Dispute telemetry shows rider arrived at pickup and waited">
                    Dispute telemetry shows rider arrived at pickup and waited
                  </option>
                  <option value="Policy violation: duplicate or abusive dispute claim">
                    Policy violation: duplicate or abusive dispute claim
                  </option>
                  <option value="Other administrative grounds">
                    Other administrative grounds
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Rejection Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Detail the factual findings for customer support ticket reference..."
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn
                small
                variant="ghost"
                onClick={() => setRejectModalItem(null)}
              >
                Cancel
              </Btn>
              <Btn small danger onClick={handleReject} disabled={processing}>
                {processing ? "Processing..." : "Confirm Rejection"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Refund Details Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ""}
        subtitle={`${selected?.type || "Refund Claim"} · Order #${selected?.orderId}`}
        badge={
          selected ? (
            <Badge
              variant={
                selected.status === "Approved"
                  ? "completed"
                  : selected.status === "Rejected"
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
            <DrawerSection title="CLAIM OVERVIEW">
              <DetailRow label="Refund ID" value={selected.id} mono />
              <DetailRow
                label="Order Reference"
                value={selected.orderId}
                mono
              />
              <DetailRow label="Customer Name" value={selected.customerName} />
              <DetailRow
                label="Customer Phone"
                value={selected.customerPhone || "—"}
                mono
              />
              <DetailRow label="Refund Amount" value={selected.amount} />
              <DetailRow label="Claim Type" value={selected.type} />
              <DetailRow label="Request Date" value={selected.requestedDate} />
              <DetailRow
                label="Assigned Reviewer"
                value={selected.assignedAdmin}
              />
            </DrawerSection>

            <DrawerSection title="CLAIM REASON & AUDIT NOTES">
              <div className="p-3 bg-[#F9F9F9] rounded-lg text-xs border border-[#E8E8E8] text-[#464646]">
                <p className="font-bold text-black mb-1">Customer Statement:</p>
                <p>{selected.reason}</p>
                {selected.disputeNotes && (
                  <>
                    <p className="font-bold text-black mt-3 mb-1">
                      Reviewer Findings:
                    </p>
                    <p>{selected.disputeNotes}</p>
                  </>
                )}
                {selected.rejectionReason && (
                  <>
                    <p className="font-bold text-[#A35E47] mt-3 mb-1">
                      Rejection Ground:
                    </p>
                    <p>{selected.rejectionReason}</p>
                  </>
                )}
                {selected.refundMethod && (
                  <>
                    <p className="font-bold text-green-700 mt-3 mb-1">
                      Disbursed Via:
                    </p>
                    <p>{selected.refundMethod}</p>
                  </>
                )}
              </div>
            </DrawerSection>

            <div className="space-y-2 pt-2">
              {(selected.status === "Pending" ||
                selected.status === "Under Review") && (
                <div className="flex gap-2">
                  <Btn
                    small
                    variant="primary"
                    onClick={() => {
                      setDrawerOpen(false)
                      setApproveModalItem(selected)
                    }}
                    className="flex-1 justify-center"
                  >
                    Approve Refund
                  </Btn>
                  <Btn
                    small
                    danger
                    onClick={() => {
                      setDrawerOpen(false)
                      setRejectModalItem(selected)
                    }}
                    className="flex-1 justify-center"
                  >
                    Reject Claim
                  </Btn>
                </div>
              )}

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
