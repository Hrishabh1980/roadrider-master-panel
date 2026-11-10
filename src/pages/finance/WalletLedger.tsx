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
  Wallet,
  PlusCircle,
  MinusCircle,
  UserCheck,
  ShieldAlert,
  SlidersHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
} from "lucide-react"

export default function WalletLedger({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  const [activeTab, setActiveTab] = useState("All Ledger Entries")
  const [search, setSearch] = useState("")
  const [userTypeFilter, setUserTypeFilter] = useState("")
  const [entryTypeFilter, setEntryTypeFilter] = useState("")
  const [reasonFilter, setReasonFilter] = useState("")
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustTargetUser, setAdjustTargetUser] = useState(
    "CUST-001 (Priya Sharma)",
  )
  const [adjustType, setAdjustType] = useState<"Credit" | "Debit">("Credit")
  const [adjustAmount, setAdjustAmount] = useState("100")
  const [adjustReason, setAdjustReason] = useState("Customer Appeasement")
  const [adjustRemarks, setAdjustRemarks] = useState("")
  const [adjusting, setAdjusting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const {
    data: response,
    loading,
    refetch,
  } = useApi(
    () =>
      financeApi.getWalletLedger({
        search,
        userType: userTypeFilter,
        entryType: entryTypeFilter,
        reason: reasonFilter,
      }),
    {
      data: [],
      total: 0,
      customerWallets: [],
      partnerWallets: [],
      stats: {
        totalLiability: "₹0",
        totalCredits: "₹0",
        totalDebits: "₹0",
        activeWalletsCount: 0,
      },
    },
    [search, userTypeFilter, entryTypeFilter, reasonFilter],
  )

  const stats = response?.stats || {
    totalLiability: "₹0",
    totalCredits: "₹0",
    totalDebits: "₹0",
    activeWalletsCount: 0,
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleAdjustBalance = async () => {
    const amtNum = parseFloat(adjustAmount)
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid positive amount.")
      return
    }
    if (!adjustRemarks.trim()) {
      showToast("Mandatory administrative remarks are required.")
      return
    }

    setAdjusting(true)
    try {
      const isCustomer = adjustTargetUser.startsWith("CUST")
      const userId = adjustTargetUser.split(" ")[0]
      const res = await financeApi.adjustWalletBalance({
        userId,
        userType: isCustomer ? "Customer" : "Partner",
        amount: amtNum,
        type: adjustType,
        reason: adjustReason,
        remarks: adjustRemarks,
      })
      showToast(res.message)
      setAdjustModalOpen(false)
      setAdjustRemarks("")
      setAdjustAmount("100")
      refetch()
    } catch {
      showToast("Failed to adjust wallet balance.")
    } finally {
      setAdjusting(false)
    }
  }

  const handleExport = () => {
    const entries = response?.data || []
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        "Entry ID,Account Holder,User ID,User Type,Type,Reason,Amount,Opening Balance,Closing Balance,Date,Ref ID",
      ].join(",") +
      "\n" +
      entries
        .map(
          (e: any) =>
            `"${e.id}","${e.accountHolder}","${e.userId}","${e.userType}","${e.entryType}","${e.reason}","${e.amount}","${e.openingBalance}","${e.closingBalance}","${e.date}","${e.referenceId}"`,
        )
        .join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "roadrider_wallet_ledger.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("Wallet ledger exported to CSV")
  }

  const tabs = ["All Ledger Entries", "Customer Wallets", "Partner Wallets"]

  // Columns for All Ledger Entries
  const entryColumns = [
    { key: "id", label: "ENTRY ID", width: "120px" },
    { key: "accountHolder", label: "ACCOUNT HOLDER" },
    { key: "userType", label: "ENTITY", width: "110px" },
    { key: "entryType", label: "TYPE", width: "110px" },
    { key: "reason", label: "CATEGORY / REASON", width: "170px" },
    { key: "amount", label: "AMOUNT", width: "110px" },
    { key: "openingBalance", label: "OPENING", width: "110px" },
    { key: "closingBalance", label: "CLOSING", width: "110px" },
    { key: "date", label: "TIMESTAMP", width: "150px" },
    { key: "actions", label: "ACTION", width: "80px" },
  ]

  const entryRows = (response?.data || []).map((e: any) => ({
    ...e,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {e.id}
      </span>
    ),
    accountHolder: (
      <div>
        <p className="font-semibold text-black text-xs">{e.accountHolder}</p>
        <p className="text-[10px] text-[#9C9A9A] font-mono-data">
          {e.userId} · {e.phone || ""}
        </p>
      </div>
    ),
    userType: (
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
          e.userType === "Customer"
            ? "bg-[#F5F5F5] text-black"
            : "bg-[#FFF8F0] text-[#A35E47]"
        }`}
      >
        {e.userType}
      </span>
    ),
    entryType: (
      <span
        className={`inline-flex items-center gap-1 text-xs font-bold ${
          e.entryType === "Credit" ? "text-green-700" : "text-[#A35E47]"
        }`}
      >
        {e.entryType === "Credit" ? (
          <ArrowDownLeft className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpRight className="w-3.5 h-3.5" />
        )}
        {e.entryType}
      </span>
    ),
    reason: <span className="text-xs font-medium text-black">{e.reason}</span>,
    amount: (
      <span
        className={`font-mono-data font-bold text-xs ${
          e.entryType === "Credit" ? "text-green-700" : "text-[#A35E47]"
        }`}
      >
        {e.amount}
      </span>
    ),
    openingBalance: (
      <span className="font-mono-data text-xs text-[#9C9A9A]">
        {e.openingBalance}
      </span>
    ),
    closingBalance: (
      <span className="font-mono-data text-xs font-semibold text-black">
        {e.closingBalance}
      </span>
    ),
    date: <span className="text-xs text-[#464646]">{e.date}</span>,
    actions: (
      <button
        onClick={(ev) => {
          ev.stopPropagation()
          setSelected(e)
          setDrawerOpen(true)
        }}
        className="text-xs text-[#A35E47] font-semibold hover:underline"
      >
        Details
      </button>
    ),
  }))

  // Columns for Customer and Partner Wallets
  const walletColumns = [
    { key: "id", label: "WALLET ID", width: "120px" },
    { key: "userName", label: "USER / OWNER" },
    { key: "phone", label: "PHONE NUMBER", width: "150px" },
    { key: "balance", label: "WALLET BALANCE", width: "150px" },
    { key: "lastActive", label: "LAST ACTIVITY", width: "150px" },
    { key: "status", label: "STATUS", width: "120px" },
    { key: "actions", label: "ACTION", width: "120px" },
  ]

  const currentWalletList =
    activeTab === "Customer Wallets"
      ? response?.customerWallets || []
      : response?.partnerWallets || []

  const walletRows = currentWalletList.map((w: any) => ({
    ...w,
    id: (
      <span className="text-xs font-mono-data font-bold text-[#464646]">
        {w.id}
      </span>
    ),
    userName: (
      <div>
        <p className="font-semibold text-black text-xs">{w.userName}</p>
        <span className="text-[10px] text-[#9C9A9A] font-mono-data">
          {w.userId}
        </span>
      </div>
    ),
    phone: (
      <span className="text-xs font-mono-data text-[#464646]">{w.phone}</span>
    ),
    balance: (
      <span className="font-bold font-mono-data text-black text-sm">
        {w.balance}
      </span>
    ),
    lastActive: <span className="text-xs text-[#464646]">{w.lastActive}</span>,
    status: <Badge variant={w.status.toLowerCase()} label={w.status} showDot />,
    actions: (
      <button
        onClick={(ev) => {
          ev.stopPropagation()
          setAdjustTargetUser(`${w.userId} (${w.userName})`)
          setAdjustModalOpen(true)
        }}
        className="text-[11px] font-semibold text-black border border-[#9C9A9A] hover:border-black px-2 py-1 rounded"
      >
        Adjust Balance
      </button>
    ),
  }))

  const filtersConfig = [
    {
      label: "All Accounts",
      options: ["Customer", "Partner"],
      value: userTypeFilter,
      onChange: setUserTypeFilter,
    },
    {
      label: "All Types",
      options: ["Credit", "Debit"],
      value: entryTypeFilter,
      onChange: setEntryTypeFilter,
    },
    {
      label: "All Reasons",
      options: [
        "Order Payment",
        "Ride Fare Deduction",
        "Wallet Topup",
        "Order Refund",
        "Partner Incentive",
        "Payout Withdrawal",
        "Manual Adjustment",
      ],
      value: reasonFilter,
      onChange: setReasonFilter,
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
        title="Wallet Ledger"
        subtitle="Customer & partner digital wallets, balance audit, credits, debits, and adjustments"
      >
        <Btn small variant="primary" onClick={() => setAdjustModalOpen(true)}>
          <PlusCircle className="w-3.5 h-3.5 mr-1" /> Manual Adjustment
        </Btn>
        <Btn
          small
          onClick={() => {
            refetch()
            showToast("Refreshed wallet balances")
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Btn>
        <Btn small onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Ledger
        </Btn>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="TOTAL SYSTEM WALLET LIABILITY"
          value={stats.totalLiability}
          sub="Cumulative balances in ecosystem"
          highlight
        />
        <KPICard
          label="TOTAL CREDITS PROCESSED"
          value={stats.totalCredits}
          sub="Top-ups, refunds & incentives"
        />
        <KPICard
          label="TOTAL DEBITS PROCESSED"
          value={stats.totalDebits}
          sub="Order fares & withdrawals"
        />
        <KPICard
          label="ACTIVE WALLET ACCOUNTS"
          value={stats.activeWalletsCount.toString()}
          sub="Customers & Fleet Drivers"
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Filter and Search */}
      <FilterBar
        onSearch={setSearch}
        filters={activeTab === "All Ledger Entries" ? filtersConfig : []}
      />

      {/* Tables based on active tab */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#9C9A9A]">
            <div className="w-6 h-6 border-2 border-[#A35E47] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading wallet ledger records...
          </div>
        ) : activeTab === "All Ledger Entries" ? (
          <DataTable
            columns={entryColumns}
            rows={entryRows}
            onRowClick={(row) => {
              setSelected(row)
              setDrawerOpen(true)
            }}
          />
        ) : (
          <DataTable columns={walletColumns} rows={walletRows} />
        )}
      </div>

      {/* Manual Wallet Adjustment Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E8E8] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#FFF8F0] text-[#A35E47]">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">
                    Manual Wallet Adjustment
                  </h3>
                  <p className="text-xs text-[#9C9A9A]">
                    Administrative credit or debit with audit logging
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="text-[#9C9A9A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Target Account
                </label>
                <select
                  value={adjustTargetUser}
                  onChange={(e) => setAdjustTargetUser(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] bg-white outline-none focus:border-black"
                >
                  <optgroup label="Customers">
                    <option value="CUST-001 (Priya Sharma)">
                      CUST-001 — Priya Sharma (₹320.00)
                    </option>
                    <option value="CUST-002 (Rahul Verma)">
                      CUST-002 — Rahul Verma (₹0.00)
                    </option>
                    <option value="CUST-003 (Anjali Singh)">
                      CUST-003 — Anjali Singh (₹1,200.00)
                    </option>
                    <option value="CUST-007 (Kavita Srivastava)">
                      CUST-007 — Kavita Srivastava (₹2,400.00)
                    </option>
                  </optgroup>
                  <optgroup label="Fleet Partners / Drivers">
                    <option value="PART-001 (Suresh Pal)">
                      PART-001 — Suresh Pal (₹3,450.00)
                    </option>
                    <option value="PART-002 (Manoj Kumar)">
                      PART-002 — Manoj Kumar (₹2,890.00)
                    </option>
                    <option value="PART-003 (Ravi Shankar)">
                      PART-003 — Ravi Shankar (₹4,120.00)
                    </option>
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    Adjustment Action
                  </label>
                  <div className="flex border border-[#9C9A9A] rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAdjustType("Credit")}
                      className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                        adjustType === "Credit"
                          ? "bg-black text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      + Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType("Debit")}
                      className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                        adjustType === "Debit"
                          ? "bg-[#A35E47] text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      - Debit
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full text-xs p-2 rounded border border-[#9C9A9A] outline-none focus:border-black font-mono-data"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Adjustment Category
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] bg-white outline-none focus:border-black"
                >
                  <option value="Customer Appeasement">
                    Customer Appeasement / Service Gesture
                  </option>
                  <option value="Technical Glitch Refund">
                    Technical Glitch / Fare Overcharge Refund
                  </option>
                  <option value="Partner Incentive Bonus">
                    Partner Incentive / Weekly Performance Bonus
                  </option>
                  <option value="Fraudulent Fare Reversal">
                    Disputed / Fraudulent Fare Reversal (Debit)
                  </option>
                  <option value="General Ledger Adjustment">
                    General Ledger Balancing Adjustment
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1">
                  Mandatory Administrative Remarks{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adjustRemarks}
                  onChange={(e) => setAdjustRemarks(e.target.value)}
                  placeholder="Record justification and authorizing administrator identity..."
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-[#9C9A9A] outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Btn
                small
                variant="ghost"
                onClick={() => setAdjustModalOpen(false)}
              >
                Cancel
              </Btn>
              <Btn
                small
                variant="primary"
                onClick={handleAdjustBalance}
                disabled={adjusting}
              >
                {adjusting
                  ? "Updating Ledger..."
                  : "Confirm Balance Adjustment"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Entry Details Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || ""}
        subtitle={`${selected?.reason || "Wallet Journal"} · ${selected?.accountHolder}`}
        badge={
          selected ? (
            <Badge
              variant={selected.entryType === "Credit" ? "completed" : "failed"}
              label={selected.entryType}
              showDot
            />
          ) : null
        }
      >
        {selected && (
          <div className="space-y-6">
            <DrawerSection title="JOURNAL ENTRY SUMMARY">
              <DetailRow label="Entry ID" value={selected.id} mono />
              <DetailRow
                label="Account Holder"
                value={selected.accountHolder}
              />
              <DetailRow label="User ID" value={selected.userId} mono />
              <DetailRow label="Entity Category" value={selected.userType} />
              <DetailRow label="Entry Type" value={selected.entryType} />
              <DetailRow label="Transaction Reason" value={selected.reason} />
              <DetailRow
                label="Adjustment Amount"
                value={
                  <span className="font-bold text-black font-mono-data">
                    {selected.amount}
                  </span>
                }
              />
              <DetailRow
                label="Opening Balance"
                value={selected.openingBalance}
              />
              <DetailRow
                label="Closing Balance"
                value={selected.closingBalance}
              />
              <DetailRow
                label="Associated Reference ID"
                value={selected.referenceId}
                mono
              />
              <DetailRow
                label="Authorized By"
                value={selected.authorizedBy || "System Automation"}
              />
              <DetailRow label="Timestamp" value={selected.date} />
            </DrawerSection>

            {selected.notes && (
              <DrawerSection title="AUDIT JUSTIFICATION">
                <div className="p-3 bg-[#F9F9F9] rounded-lg text-xs border border-[#E8E8E8] text-[#464646]">
                  <p>{selected.notes}</p>
                </div>
              </DrawerSection>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
