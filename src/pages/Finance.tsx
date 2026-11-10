import React from "react"
import FinanceDashboard from "./finance/FinanceDashboard"

export { default as FinanceDashboard } from "./finance/FinanceDashboard"
export { default as Transactions } from "./finance/Transactions"
export { default as Payments } from "./finance/Payments"
export { default as RefundsDisputes } from "./finance/RefundsDisputes"
export { default as Payouts } from "./finance/Payouts"
export { default as Reconciliation } from "./finance/Reconciliation"
export { default as WalletLedger } from "./finance/WalletLedger"

export default function Finance({
  onNavigate,
}: {
  onNavigate?: (page: string) => void
}) {
  return <FinanceDashboard onNavigate={onNavigate} />
}
