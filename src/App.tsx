import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Partners from './pages/Partners';
import Orders from './pages/Orders';
import Finance from './pages/Finance';
import Risk from './pages/Risk';
import Support from './pages/Support';
import Analytics from './pages/Analytics';
import Pricing from './pages/Pricing';
import Promotions from './pages/Promotions';
import Cities from './pages/Cities';
import KYC from './pages/KYC';
import System from './pages/System';
import UnitEconomics from './pages/UnitEconomics';
import AdminAssignment from './pages/AdminAssignment';
import LiveJobs from './pages/LiveJobs';
import {
  Rides, Courier, Vehicles, Dispatch, Slots, Notifications, PlaceholderPage
} from './pages/Misc';
import { Restaurants, GroceryStores, Products, Categories } from './pages/Marketplace';
import Login from './pages/Login';
import { authApi } from './services/api';
import { supabase } from './services/supabase';
import { PermissionsProvider } from './context/PermissionsContext';
import { BadgeProvider } from './context/BadgeContext';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);

  const parseRoute = (rawHash: string) => {
    const clean = rawHash.replace(/^#\/?/, '').trim();
    if (clean.toLowerCase().includes('kyc')) return 'kyc';
    return clean || 'dashboard';
  };

  const getInitialPage = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) return parseRoute(hash);
      const path = window.location.pathname.replace(/^\//, '').trim();
      if (path.toLowerCase().includes('kyc')) return 'kyc';
      return path || 'dashboard';
    }
    return 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState<string>(getInitialPage);

  useEffect(() => {
    const handleHashChange = () => {
      const page = parseRoute(window.location.hash);
      setCurrentPage(page);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: string) => {
    if (typeof window !== 'undefined') {
      window.location.hash = page;
    }
    setCurrentPage(page);
  };

  useEffect(() => {
    let mounted = true;

    // Verify session with Supabase on mount
    authApi.verifyCurrentSession().then(({ isAuthenticated: authed, user }) => {
      if (mounted) {
        setIsAuthenticated(authed);
        setCurrentUser(user);
        setIsVerifyingSession(false);
      }
    });

    // Listen to Supabase auth state changes (sign out, token expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (mounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { isAuthenticated: authed, user } = await authApi.verifyCurrentSession();
        if (mounted) {
          setIsAuthenticated(authed);
          setCurrentUser(user);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await authApi.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

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
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'notifications': return <Notifications onNavigate={handleNavigate} />;

      case 'customers': return <Customers onNavigate={handleNavigate} />;
      case 'vendors': return <Vendors onNavigate={handleNavigate} />;
      case 'riders':
      case 'partners': return <Partners onNavigate={handleNavigate} />;
      case 'vehicles': return <Vehicles onNavigate={handleNavigate} />;

      case 'live-jobs': return <LiveJobs onNavigate={handleNavigate} />;
      case 'orders': return <Orders onNavigate={handleNavigate} />;
      case 'rides': return <Rides onNavigate={handleNavigate} />;
      case 'courier': return <Courier onNavigate={handleNavigate} />;
      case 'dispatch': return <Dispatch onNavigate={handleNavigate} />;
      case 'slots': return <Slots onNavigate={handleNavigate} />;

      case 'restaurants': return <Restaurants />;
      case 'grocery-stores': return <GroceryStores />;
      case 'products': return <Products />;
      case 'categories': return <Categories />;
      case 'cities': return <Cities />;
      case 'service-availability': return <Cities />;

      case 'finance': return <Finance onNavigate={handleNavigate} />;
      case 'transactions': return <Finance onNavigate={handleNavigate} />;
      case 'payments': return <Finance onNavigate={handleNavigate} />;
      case 'refunds': return (
        <div className="p-6">
          <h1 className="text-2xl font-black mb-6">Refunds & Disputes</h1>
          <Finance onNavigate={handleNavigate} />
        </div>
      );
      case 'payouts': return <Finance onNavigate={handleNavigate} />;
      case 'reconciliation': return <Finance onNavigate={handleNavigate} />;
      case 'wallet': return <Finance onNavigate={handleNavigate} />;

      case 'pricing': return <Pricing />;
      case 'surge': return <Pricing />;
      case 'commission': return <Pricing />;

      case 'promotions': return <Promotions />;
      case 'sponsored': return <Promotions />;

      case 'risk': return <Risk />;
      case 'fraud': return <Risk />;
      case 'safety': return <Risk />;
      case 'kyc':
      case 'onboarding/mobile#kyc':
      case 'onboarding/mobile':
      case 'onboarding/kyc':
        return <KYC />;

      case 'support': return <Support onNavigate={handleNavigate} />;
      case 'tickets': return <Support onNavigate={handleNavigate} />;

      case 'analytics': return <Analytics />;
      case 'unit-economics': return <UnitEconomics />;

      case 'admin-users': return <AdminAssignment />;
      case 'roles': return <AdminAssignment />;
      case 'audit-logs': return <System />;
      case 'system': return <System />;

      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <PermissionsProvider currentUser={currentUser}>
      <BadgeProvider>
        <div className="flex h-screen overflow-hidden bg-white">
          <Sidebar currentPage={currentPage} onNavigate={handleNavigate} currentUser={currentUser} />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header
              currentPage={currentPage}
              currentUser={currentUser}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
            <main className="flex-1 overflow-y-auto">
              <ErrorBoundary key={currentPage}>
                {renderPage()}
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </BadgeProvider>
    </PermissionsProvider>
  );
}
