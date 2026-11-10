import React, { useState, useEffect } from "react"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import Dashboard from "./pages/Dashboard"
import Customers from "./pages/Customers"
import Vendors from "./pages/Vendors"
import Partners from "./pages/Partners"
import Orders from "./pages/Orders"
import Finance, {
  FinanceDashboard,
  Transactions,
  Payments,
  RefundsDisputes,
  Payouts,
  Reconciliation,
  WalletLedger,
} from "./pages/Finance"
import Risk from "./pages/Risk"
import Support from "./pages/Support"
import Analytics from "./pages/Analytics"
import Pricing from "./pages/Pricing"
import Promotions from "./pages/Promotions"
import Cities from "./pages/Cities"
import KYC from "./pages/KYC"
import System from "./pages/System"
import UnitEconomics from "./pages/UnitEconomics"
import AdminAssignment from "./pages/AdminAssignment"
import LiveJobs from "./pages/LiveJobs"
import {
  Rides,
  Courier,
  Vehicles,
  Dispatch,
  Slots,
  Notifications,
  PlaceholderPage,
} from "./pages/Misc"
import {
  Restaurants,
  GroceryStores,
  Products,
  Categories,
} from "./pages/Marketplace"
import Login from "./pages/Login"
import { authApi } from "./services/api"
import { supabase } from "./services/supabase"
import { PermissionsProvider, usePermissions } from "./context/PermissionsContext"
import { BadgeProvider } from "./context/BadgeContext"
import ErrorBoundary from "./components/ErrorBoundary"


// BUG-001 FIX: Access denied page shown when a sub-admin navigates to a restricted route
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-[#A35E47]/10 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[#A35E47]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-black mb-2">Access Restricted</h2>
      <p className="text-sm text-[#9C9A9A] max-w-sm">
        You do not have permission to view this module. Contact your Super Admin to request access.
      </p>
    </div>
  )
}

// BUG-001 FIX: Route-level permission guard – prevents hash-based bypass
function GuardedPage({ pageId, children }: { pageId: string; children: React.ReactNode }) {
  const { canViewPage } = usePermissions()
  if (!canViewPage(pageId)) return <AccessDenied />
  return <>{children}</>
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true)

  const parseRoute = (rawHash: string) => {
    const clean = rawHash.replace(/^#\/?/, "").trim()
    if (clean.toLowerCase().includes("kyc")) return "kyc"
    return clean || "dashboard"
  }

  const getInitialPage = () => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash
      if (hash) return parseRoute(hash)
      const path = window.location.pathname.replace(/^\//, "").trim()
      if (path.toLowerCase().includes("kyc")) return "kyc"
      return path || "dashboard"
    }
    return "dashboard"
  }

  const [currentPage, setCurrentPage] = useState<string>(getInitialPage)

  useEffect(() => {
    const handleHashChange = () => {
      const page = parseRoute(window.location.hash)
      setCurrentPage(page)
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const handleNavigate = (page: string) => {
    if (typeof window !== "undefined") {
      window.location.hash = page
    }
    setCurrentPage(page)
  }

  useEffect(() => {
    let mounted = true

    // Verify session with Supabase on mount
    authApi.verifyCurrentSession().then(({ isAuthenticated: authed, user }) => {
      if (mounted) {
        setIsAuthenticated(authed)
        setCurrentUser(user)
        setIsVerifyingSession(false)
      }
    })

    // Listen to Supabase auth state changes (sign out, token expiry)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (mounted) {
          setIsAuthenticated(false)
          setCurrentUser(null)
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const { isAuthenticated: authed, user } =
          await authApi.verifyCurrentSession()
        if (mounted) {
          setIsAuthenticated(authed)
          setCurrentUser(user)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  const handleLogout = async () => {
    await authApi.logout()
    setIsAuthenticated(false)
    setCurrentUser(null)
  }

  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex flex-col items-center justify-center p-6 text-white font-sans">
        <img
          src="/roadrider-delivery-logo.png"
          alt="RoadRider"
          className="h-12 w-auto max-w-[200px] object-contain mb-6 select-none"
        />
        <div className="w-7 h-7 border-2 border-[#FF6600] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-[#8E8E8E] tracking-wider uppercase">
          Verifying Enterprise Admin Session...
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  // BUG-001 FIX: renderPage now wraps restricted modules in GuardedPage
  // so hash-based URL manipulation cannot bypass RBAC permission checks.
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />
      case "notifications":
        return <GuardedPage pageId="notifications"><Notifications onNavigate={handleNavigate} /></GuardedPage>

      case "customers":
        return <GuardedPage pageId="customers"><Customers onNavigate={handleNavigate} /></GuardedPage>
      case "vendors":
        return <GuardedPage pageId="vendors"><Vendors onNavigate={handleNavigate} /></GuardedPage>
      case "riders":
      case "partners":
        return <GuardedPage pageId="riders"><Partners onNavigate={handleNavigate} /></GuardedPage>
      case "vehicles":
        return <GuardedPage pageId="vehicles"><Vehicles onNavigate={handleNavigate} /></GuardedPage>

      case "live-jobs":
        return <GuardedPage pageId="live-jobs"><LiveJobs onNavigate={handleNavigate} /></GuardedPage>
      case "orders":
        return <GuardedPage pageId="orders"><Orders onNavigate={handleNavigate} /></GuardedPage>
      case "rides":
        return <GuardedPage pageId="rides"><Rides onNavigate={handleNavigate} /></GuardedPage>
      case "courier":
        return <GuardedPage pageId="courier"><Courier onNavigate={handleNavigate} /></GuardedPage>
      case "dispatch":
        return <GuardedPage pageId="dispatch"><Dispatch onNavigate={handleNavigate} /></GuardedPage>
      case "slots":
        return <GuardedPage pageId="slots"><Slots onNavigate={handleNavigate} /></GuardedPage>

      case "restaurants":
        return <GuardedPage pageId="restaurants"><Restaurants /></GuardedPage>
      case "grocery-stores":
        return <GuardedPage pageId="grocery-stores"><GroceryStores /></GuardedPage>
      case "products":
        return <GuardedPage pageId="products"><Products /></GuardedPage>
      case "categories":
        return <GuardedPage pageId="categories"><Categories /></GuardedPage>
      case "cities":
        return <GuardedPage pageId="cities"><Cities /></GuardedPage>
      case "service-availability":
        return <GuardedPage pageId="service-availability"><Cities /></GuardedPage>

      case "finance":
        return <GuardedPage pageId="finance"><FinanceDashboard onNavigate={handleNavigate} /></GuardedPage>
      case "transactions":
        return <GuardedPage pageId="transactions"><Transactions onNavigate={handleNavigate} /></GuardedPage>
      case "payments":
        return <GuardedPage pageId="payments"><Payments onNavigate={handleNavigate} /></GuardedPage>
      case "refunds":
        // BUG-026 FIX: Pass directly without double-wrapping outer div+h1
        return <GuardedPage pageId="refunds"><RefundsDisputes onNavigate={handleNavigate} /></GuardedPage>
      case "payouts":
        return <GuardedPage pageId="payouts"><Payouts onNavigate={handleNavigate} /></GuardedPage>
      case "reconciliation":
        return <GuardedPage pageId="reconciliation"><Reconciliation onNavigate={handleNavigate} /></GuardedPage>
      case "wallet":
        return <GuardedPage pageId="wallet"><WalletLedger onNavigate={handleNavigate} /></GuardedPage>

      case "pricing":
        return <GuardedPage pageId="pricing"><Pricing /></GuardedPage>
      case "surge":
        return <GuardedPage pageId="surge"><Pricing /></GuardedPage>
      case "commission":
        return <GuardedPage pageId="commission"><Pricing /></GuardedPage>

      case "promotions":
        return <GuardedPage pageId="promotions"><Promotions /></GuardedPage>
      case "sponsored":
        return <GuardedPage pageId="sponsored"><Promotions /></GuardedPage>

      case "risk":
        return <GuardedPage pageId="risk"><Risk /></GuardedPage>
      case "fraud":
        return <GuardedPage pageId="fraud"><Risk /></GuardedPage>
      case "safety":
        return <GuardedPage pageId="safety"><Risk /></GuardedPage>
      case "kyc":
      case "onboarding/mobile#kyc":
      case "onboarding/mobile":
      case "onboarding/kyc":
        return <GuardedPage pageId="kyc"><KYC /></GuardedPage>

      case "support":
        return <GuardedPage pageId="support"><Support onNavigate={handleNavigate} /></GuardedPage>
      case "tickets":
        return <GuardedPage pageId="tickets"><Support onNavigate={handleNavigate} /></GuardedPage>

      case "analytics":
        return <GuardedPage pageId="analytics"><Analytics /></GuardedPage>
      case "unit-economics":
        return <GuardedPage pageId="unit-economics"><UnitEconomics /></GuardedPage>

      case "admin-users":
        return <GuardedPage pageId="admin-users"><AdminAssignment /></GuardedPage>
      case "roles":
        return <GuardedPage pageId="roles"><AdminAssignment /></GuardedPage>
      case "audit-logs":
        return <GuardedPage pageId="audit-logs"><System /></GuardedPage>
      case "system":
        return <GuardedPage pageId="system"><System /></GuardedPage>

      default:
        return <Dashboard onNavigate={handleNavigate} />
    }
  }

  return (
    <PermissionsProvider currentUser={currentUser}>
      <BadgeProvider>
        <div className="flex h-screen overflow-hidden bg-white">
          <Sidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            currentUser={currentUser}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header
              currentPage={currentPage}
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
            <main className="flex-1 overflow-y-auto">
              <ErrorBoundary key={currentPage}>{renderPage()}</ErrorBoundary>
            </main>
          </div>
        </div>
      </BadgeProvider>
    </PermissionsProvider>
  )
}
