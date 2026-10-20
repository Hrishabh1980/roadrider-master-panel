import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Bell, HelpCircle, ChevronDown, MapPin, Calendar, Zap, LogOut,
  Shield, UserPlus, Tag, Store, UserCheck, RefreshCw, AlertTriangle, FileText,
  X, Check, ExternalLink, ArrowRight
} from 'lucide-react';
import SupabaseBadge from './SupabaseBadge';
import { useBadges } from '../context/BadgeContext';

const PAGE_LABELS: Record<string, string[]> = {
  'dashboard': ['Dashboard'],
  'notifications': ['Notifications'],
  'customers': ['Users', 'Customers'],
  'vendors': ['Users', 'Vendors'],
  'partners': ['Users', 'Partners'],
  'vehicles': ['Users', 'Vehicles'],
  'live-jobs': ['Operations', 'Live Jobs'],
  'orders': ['Operations', 'Orders'],
  'rides': ['Operations', 'Rides'],
  'courier': ['Operations', 'Courier Jobs'],
  'dispatch': ['Operations', 'Dispatch'],
  'slots': ['Operations', 'Partner Slots'],
  'restaurants': ['Marketplace', 'Restaurants'],
  'grocery-stores': ['Marketplace', 'Grocery Stores'],
  'products': ['Marketplace', 'Products / Menu'],
  'categories': ['Marketplace', 'Categories'],
  'cities': ['Marketplace', 'Cities & Zones'],
  'service-availability': ['Marketplace', 'Service Availability'],
  'finance': ['Finance', 'Finance Dashboard'],
  'transactions': ['Finance', 'Transactions'],
  'payments': ['Finance', 'Payments'],
  'refunds': ['Finance', 'Refunds & Disputes'],
  'payouts': ['Finance', 'Payouts'],
  'reconciliation': ['Finance', 'Reconciliation'],
  'wallet': ['Finance', 'Wallet Ledger'],
  'pricing': ['Pricing', 'Pricing Rules'],
  'surge': ['Pricing', 'Surge Rules'],
  'commission': ['Pricing', 'Commission'],
  'promotions': ['Growth', 'Promotions'],
  'sponsored': ['Growth', 'Sponsored'],
  'risk': ['Safety & Risk', 'Risk Dashboard'],
  'fraud': ['Safety & Risk', 'Fraud Flags'],
  'safety': ['Safety & Risk', 'Safety Incidents'],
  'kyc': ['Safety & Risk', 'KYC / Documents'],
  'support': ['Support', 'Support Dashboard'],
  'tickets': ['Support', 'All Tickets'],
  'analytics': ['Analytics', 'Business Analytics'],
  'unit-economics': ['Analytics', 'Unit Economics'],
  'admin-users': ['System', 'Admin Users'],
  'roles': ['System', 'Roles & Permissions'],
  'audit-logs': ['System', 'Audit Logs'],
  'system': ['System', 'System Settings'],
};

interface HeaderProps {
  currentPage: string;
  currentUser?: {
    name?: string;
    email?: string;
    role?: string;
    avatar?: string;
  } | null;
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
}

export default function Header({ currentPage, currentUser, onLogout, onNavigate }: HeaderProps) {
  const { badgeCounts } = useBadges();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [activeZone, setActiveZone] = useState('All Lucknow Zones');

  const profileRef = useRef<HTMLDivElement>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const crumbs = PAGE_LABELS[currentPage] || [currentPage];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (quickActionRef.current && !quickActionRef.current.contains(event.target as Node)) {
        setQuickActionOpen(false);
      }
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
        setCityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !onNavigate) return;
    const q = searchQuery.toLowerCase().trim();

    if (q.includes('order')) onNavigate('orders');
    else if (q.includes('ride')) onNavigate('rides');
    else if (q.includes('courier')) onNavigate('courier');
    else if (q.includes('vendor') || q.includes('store') || q.includes('restaurant')) onNavigate('vendors');
    else if (q.includes('partner') || q.includes('driver')) onNavigate('partners');
    else if (q.includes('vehicle')) onNavigate('vehicles');
    else if (q.includes('live') || q.includes('job')) onNavigate('live-jobs');
    else if (q.includes('dispatch')) onNavigate('dispatch');
    else if (q.includes('customer') || q.includes('user')) onNavigate('customers');
    else if (q.includes('finance') || q.includes('payment') || q.includes('payout')) onNavigate('finance');
    else if (q.includes('refund')) onNavigate('refunds');
    else if (q.includes('price') || q.includes('surge') || q.includes('rate')) onNavigate('pricing');
    else if (q.includes('promo') || q.includes('coupon')) onNavigate('promotions');
    else if (q.includes('risk') || q.includes('fraud') || q.includes('safety')) onNavigate('risk');
    else if (q.includes('kyc') || q.includes('doc')) onNavigate('kyc');
    else if (q.includes('support') || q.includes('ticket')) onNavigate('support');
    else if (q.includes('analytics') || q.includes('econ') || q.includes('metric')) onNavigate('analytics');
    else if (q.includes('admin') || q.includes('role') || q.includes('assign')) onNavigate('admin-users');
    else if (q.includes('city') || q.includes('zone')) onNavigate('cities');
    else onNavigate('dashboard');

    setSearchQuery('');
  };

  const userName = currentUser?.name || 'Ashish Agarwal';
  const userRole = (currentUser?.role === 'admin' || (currentUser as any)?.roleId === 'super_admin') ? 'Super Admin' : (currentUser?.role || 'Super Admin');
  const userEmail = currentUser?.email || 'techroadrider@gmail.com';
  const userInitials = (currentUser?.name || 'Ashish Agarwal')
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AA';

  const QUICK_ACTIONS = [
    { label: 'Live Operations Feed', sub: 'Monitor active jobs in real-time', page: 'live-jobs', icon: <Zap className="w-4 h-4 text-[#A35E47]" /> },
    { label: 'Dispatch Console', sub: 'Assign jobs to nearby drivers', page: 'dispatch', icon: <ArrowRight className="w-4 h-4 text-blue-600" /> },
    { label: 'Assign Sub-Admin', sub: 'Grant permissions to staff & managers', page: 'admin-users', icon: <UserPlus className="w-4 h-4 text-purple-600" /> },
    { label: 'Create Promo Campaign', sub: 'Launch discount code for customers', page: 'promotions', icon: <Tag className="w-4 h-4 text-emerald-600" /> },
    { label: 'Review Pending KYC', sub: 'Inspect documents awaiting verification', page: 'kyc', icon: <FileText className="w-4 h-4 text-amber-600" /> },
    { label: 'Issue Refund / Dispute', sub: 'Process customer dispute claims', page: 'refunds', icon: <RefreshCw className="w-4 h-4 text-rose-600" /> },
    { label: 'Safety & Risk Dashboard', sub: 'Investigate fraud and risk flags', page: 'risk', icon: <Shield className="w-4 h-4 text-red-600" /> },
    { label: 'Cities & Zone Multipliers', sub: 'Manage operational cities & zones', page: 'cities', icon: <MapPin className="w-4 h-4 text-black" /> },
  ];

  const LUCKNOW_ZONES = [
    { name: 'All Operational Zones', status: 'Optimal' },
    { name: 'Zone A — Gomti Nagar', status: 'Optimal' },
    { name: 'Zone B — Hazratganj', status: 'Optimal' },
    { name: 'Zone C — Aliganj', status: 'Optimal' },
    { name: 'Zone D — Indira Nagar', status: 'Optimal' },
    { name: 'Zone E — Alambagh', status: 'Optimal' },
  ];

  return (
    <header className="h-14 bg-white border-b border-[#E8E8E8] flex items-center px-5 gap-4 flex-shrink-0 z-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
        {crumbs.map((c, i) => (
          <React.Fragment key={c}>
            {i > 0 && <span className="text-[#9C9A9A] text-xs">/</span>}
            <span className={`text-xs font-semibold ${i === crumbs.length - 1 ? 'text-black' : 'text-[#9C9A9A]'}`}>
              {c}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Global search form */}
      <form onSubmit={handleSearchSubmit} className={`relative flex-1 max-w-lg transition-all ${searchFocused ? 'max-w-2xl' : ''}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9C9A9A]" />
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search pages, orders, partners, vendors (press Enter to jump)…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E8E8E8] focus:border-black outline-none bg-[#FAFAFA] focus:bg-white transition-all"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9C9A9A] text-[10px] font-medium">↵</span>
      </form>

      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
        {/* City selector dropdown */}
        <div className="relative" ref={cityRef}>
          <button
            onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#464646] hover:bg-[#F5F5F5] transition-colors border border-transparent hover:border-[#E8E8E8] cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-[#A35E47]" />
            {activeZone.replace('Zone ', 'Z-').slice(0, 16)}
            <ChevronDown className={`w-3 h-3 text-[#9C9A9A] transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {cityDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-white border border-[#E8E8E8] rounded-xl shadow-xl py-1.5 z-50 animate-fadeIn">
              <div className="px-3 py-2 border-b border-[#F0F0F0]">
                <p className="text-[10px] font-bold text-[#9C9A9A] uppercase tracking-wider">Operational City: Lucknow</p>
              </div>
              {LUCKNOW_ZONES.map(z => (
                <button
                  key={z.name}
                  onClick={() => {
                    setActiveZone(z.name);
                    setCityDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#FAFAFA] transition-colors cursor-pointer ${activeZone === z.name ? 'bg-[#FFF8F6] text-[#A35E47] font-bold' : 'text-[#464646]'}`}
                >
                  <span className="truncate">{z.name}</span>
                  <span className="text-[10px] font-mono text-[#9C9A9A] ml-2 shrink-0">{z.status}</span>
                </button>
              ))}
              <div className="p-2 border-t border-[#F0F0F0]">
                <button
                  onClick={() => {
                    setCityDropdownOpen(false);
                    if (onNavigate) onNavigate('cities');
                  }}
                  className="w-full text-center text-xs font-bold text-[#A35E47] hover:underline"
                >
                  Manage Zones in Settings →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <button
          onClick={() => onNavigate && onNavigate('analytics')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#464646] hover:bg-[#F5F5F5] transition-colors border border-transparent hover:border-[#E8E8E8] cursor-pointer"
          title="Open Business Analytics"
        >
          <Calendar className="w-3.5 h-3.5 text-[#9C9A9A]" />
          Today
        </button>

        {/* Supabase Live Status */}
        <SupabaseBadge />

        {/* Quick action with Popover Menu */}
        <div className="relative" ref={quickActionRef}>
          <button
            onClick={() => setQuickActionOpen(!quickActionOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#A35E47] hover:bg-[#8E513D] active:scale-[0.99] transition-all cursor-pointer shadow-sm shadow-[#A35E47]/30"
          >
            <Zap className="w-3.5 h-3.5" />
            Quick Action
            <ChevronDown className={`w-3 h-3 transition-transform ${quickActionOpen ? 'rotate-180' : ''}`} />
          </button>

          {quickActionOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E8E8E8] rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
              <div className="px-4 py-2 border-b border-[#F0F0F0]">
                <p className="text-xs font-black text-black">Fast Jump & Actions</p>
                <p className="text-[10px] text-[#9C9A9A]">Quick shortcuts to common management tasks</p>
              </div>

              <div className="p-1.5 space-y-0.5">
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    onClick={() => {
                      setQuickActionOpen(false);
                      if (onNavigate) onNavigate(action.page);
                    }}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#FAFAFA] transition-colors cursor-pointer text-left group"
                  >
                    <div className="p-2 rounded-lg bg-[#F5F5F5] group-hover:bg-white group-hover:shadow-sm transition-all shrink-0">
                      {action.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-black group-hover:text-[#A35E47] transition-colors">{action.label}</p>
                      <p className="text-[10px] text-[#9C9A9A] truncate">{action.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-[#E8E8E8] mx-1" />

        {/* Notifications button */}
        <button
          onClick={() => onNavigate && onNavigate('notifications')}
          className="relative p-2 rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          title="Open Notifications & Alerts"
        >
          <Bell className="w-4 h-4 text-[#464646]" />
          {badgeCounts.notifications > 0 && (
            <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#A35E47] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
              {badgeCounts.notifications}
            </span>
          )}
        </button>

        {/* Help */}
        <button
          onClick={() => setHelpModalOpen(true)}
          className="p-2 rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          title="System Help & Documentation"
        >
          <HelpCircle className="w-4 h-4 text-[#9C9A9A] hover:text-black" />
        </button>

        {/* Profile with Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#A35E47]/30">
              {userInitials}
            </div>
            <div className="text-left hidden xl:block">
              <p className="text-xs font-semibold text-black leading-tight">{userName}</p>
              <p className="text-[10px] text-[#A35E47] font-bold leading-tight uppercase tracking-wider">{userRole}</p>
            </div>
            <ChevronDown className={`w-3 h-3 text-[#9C9A9A] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E8E8E8] rounded-xl shadow-xl py-2 z-50 animate-fadeIn">
              <div className="px-4 py-2.5 border-b border-[#F0F0F0]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-black">{userName}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-[#A35E47]/10 text-[#A35E47]">
                    {userRole}
                  </span>
                </div>
                <p className="text-[11px] text-[#9C9A9A] font-mono truncate">{userEmail}</p>
              </div>

              <div className="px-4 py-2 border-b border-[#F0F0F0] text-[11px] text-[#6E6E6E] space-y-1">
                <div className="flex items-center justify-between">
                  <span>Assigned City</span>
                  <span className="font-bold text-black">Lucknow (All Zones)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Session</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Verified
                  </span>
                </div>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    if (onNavigate) onNavigate('admin-users');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#464646] hover:bg-[#F5F5F5] rounded-lg transition-colors cursor-pointer text-left"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#9C9A9A]" />
                  Manage Sub-Admins
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                  Sign Out of Console
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help & Documentation Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/roadrider-delivery-logo.png"
                  alt="RoadRider"
                  className="h-6 w-auto max-w-[90px] object-contain select-none"
                />
                <span className="text-black/30 font-light">|</span>
                <h3 className="font-black text-sm text-black">Console Help</h3>
              </div>
              <button onClick={() => setHelpModalOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#464646] mb-5">
              <div className="p-3 bg-[#FAFAFA] rounded-xl border border-[#E8E8E8]">
                <p className="font-bold text-black mb-1">🚀 Quick Navigation</p>
                <p className="text-[#9C9A9A]">Use the search bar at the top or press Enter on keywords (e.g., "orders", "kyc", "pricing") to instantly open any page.</p>
              </div>

              <div className="p-3 bg-[#FAFAFA] rounded-xl border border-[#E8E8E8]">
                <p className="font-bold text-black mb-1">🛡️ Role & Permission Matrix</p>
                <p className="text-[#9C9A9A]">Super Admins can create and customize sub-admin permissions under <strong>System → Admin Users</strong>.</p>
              </div>

              <div className="p-3 bg-[#FAFAFA] rounded-xl border border-[#E8E8E8]">
                <p className="font-bold text-black mb-1">📍 Lucknow Zone Controls</p>
                <p className="text-[#9C9A9A]">Manage zone multipliers and surge pricing dynamically under <strong>Pricing & Rules</strong> or <strong>Cities & Zones</strong>.</p>
              </div>
            </div>

            <button
              onClick={() => setHelpModalOpen(false)}
              className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]"
            >
              Got it, close
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
