// ─────────────────────────────────────────────────────────────────────
//  RoadRider Super Admin — Finance & Treasury Data Models
// ─────────────────────────────────────────────────────────────────────

export interface FinancialSummary {
  grossVolume: string
  netRevenue: string
  processedTransactions: string
  pendingPayouts: string
  successRate: string
}

export interface TransactionRecord {
  id: string
  _dbId?: string
  orderId?: string
  date: string
  type: "Order Payment" | "Vendor Payout" | "Partner Payout" | "Wallet Topup" | "Refund" | string
  entity: string
  entityType?: "Customer" | "Vendor" | "Partner" | string
  amount: string
  amountNum: number
  net: string
  fee: string
  tax: string
  status: "Completed" | "Success" | "Pending" | "Failed" | "Refunded" | string
  method: "UPI" | "Card" | "NetBanking" | "Wallet" | "Cash" | string
  ref: string
  zone?: string
  service?: string
  raw?: any
}

export interface PaymentRecord {
  id: string
  orderId: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  amount: string
  amountNum: number
  gateway: "Razorpay" | "Cashfree" | "PayU" | "Stripe" | "UPI Direct" | string
  gatewayRef: string
  method: "UPI" | "Credit Card" | "Debit Card" | "NetBanking" | "Wallet" | "COD" | string
  status: "Captured" | "Authorized" | "Pending" | "Failed" | string
  verificationStatus: "Verified" | "Pending Verification" | "Failed Check" | string
  date: string
  fee: string
  attempts?: number
  failureReason?: string
  service: string
}

export interface RefundRecord {
  id: string
  orderId: string
  customerName: string
  customerPhone?: string
  amount: string
  amountNum: number
  reason: string
  requestedDate: string
  status: "Pending" | "Under Review" | "Approved" | "Rejected" | string
  type: "Refund Request" | "Dispute" | "Chargeback" | string
  assignedAdmin: string
  disputeNotes?: string
  resolutionDate?: string
  refundMethod?: string
  rejectionReason?: string
}

export interface PayoutRecord {
  id: string
  _dbId?: string
  recipientName: string
  recipientType: "Rider" | "Vendor" | "Partner" | string
  maskedAccount: string
  bankName: string
  ifscMasked?: string
  amount: string
  amountNum: number
  platformFeeDeducted: string
  netPayout: string
  status: "Pending" | "Processing" | "Completed" | "Failed" | string
  scheduledDate: string
  disbursedDate?: string
  utrRef: string
  cyclePeriod?: string
}

export interface ReconciliationRecord {
  id: string
  transactionRef: string
  gatewayRef: string
  internalAmount: string
  gatewayAmount: string
  difference: string
  differenceNum: number
  type: "Matched" | "Fee Mismatch" | "Timing Difference" | "Missing Gateway Record" | "Chargeback Hold" | string
  status: "Matched" | "Discrepancy" | "Resolved" | "Under Review" | string
  date: string
  gatewayName: string
  notes?: string
}

export interface WalletLedgerEntry {
  id: string
  accountHolder: string
  userId: string
  userType: "Customer" | "Partner" | string
  phone?: string
  entryType: "Credit" | "Debit"
  reason: "Order Payment" | "Ride Fare Deduction" | "Wallet Topup" | "Order Refund" | "Partner Incentive" | "Payout Withdrawal" | "Manual Adjustment" | string
  amount: string
  amountNum: number
  openingBalance: string
  closingBalance: string
  date: string
  referenceId: string
  authorizedBy?: string
  notes?: string
}

export interface WalletAccount {
  id: string
  userId: string
  userName: string
  userType: "Customer" | "Partner"
  phone: string
  balance: string
  balanceNum: number
  lastActive: string
  status: "Active" | "Suspended"
}
