import React, { useState } from 'react';
import {
  LayoutDashboard, Radio, Bell, Users, Store, UserCheck, Truck, Zap, ShoppingBag, Car, Package,
  Navigation, Map, UtensilsCrossed, ShoppingCart, Tag, Layers, Grid3x3, Globe, ToggleLeft,
  BarChart3, ArrowLeftRight, CreditCard, RotateCcw, AlertCircle, Wallet, Percent, TrendingUp,
  Gift, Star, Shield, Flag, HeartHandshake, FileCheck, ClipboardList, Headphones, MessageSquare,
  PieChart, DollarSign, Settings, UserCog, Key, FileText, Wrench, ChevronDown, ChevronRight,
  ChevronsLeft, ChevronsRight, Lock
} from 'lucide-react';
import { usePermissions } from '../context/PermissionsContext';
import { useBadges } from '../context/BadgeContext';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    section: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    ],
  },
  {
    section: 'USERS',
    items: [
      { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
      { id: 'vendors', label: 'Vendors', icon: <Store className="w-4 h-4" /> },
      { id: 'partners', label: 'Riders & Approvals', icon: <UserCheck className="w-4 h-4" /> },
      { id: 'vehicles', label: 'Vehicles', icon: <Truck className="w-4 h-4" /> },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { id: 'live-jobs', label: 'Live Jobs', icon: <Zap className="w-4 h-4" /> },
      { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
      { id: 'rides', label: 'Rides', icon: <Car className="w-4 h-4" /> },
      { id: 'courier', label: 'Courier Jobs', icon: <Package className="w-4 h-4" /> },
      { id: 'dispatch', label: 'Dispatch', icon: <Navigation className="w-4 h-4" /> },
      { id: 'slots', label: 'Partner Slots', icon: <Grid3x3 className="w-4 h-4" /> },
    ],
  },
  {
    section: 'MARKETPLACE',
    items: [
      { id: 'restaurants', label: 'Restaurants', icon: <UtensilsCrossed className="w-4 h-4" /> },
      { id: 'grocery-stores', label: 'Grocery Stores', icon: <ShoppingCart className="w-4 h-4" /> },
      { id: 'products', label: 'Products / Menu', icon: <Tag className="w-4 h-4" /> },
      { id: 'categories', label: 'Categories', icon: <Layers className="w-4 h-4" /> },
      { id: 'cities', label: 'Cities & Zones', icon: <Globe className="w-4 h-4" /> },
      { id: 'service-availability', label: 'Service Availability', icon: <ToggleLeft className="w-4 h-4" /> },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { id: 'finance', label: 'Finance Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'transactions', label: 'Transactions', icon: <ArrowLeftRight className="w-4 h-4" /> },
      { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
      { id: 'refunds', label: 'Refunds & Disputes', icon: <RotateCcw className="w-4 h-4" /> },
      { id: 'payouts', label: 'Payouts', icon: <DollarSign className="w-4 h-4" /> },
      { id: 'reconciliation', label: 'Reconciliation', icon: <AlertCircle className="w-4 h-4" /> },
      { id: 'wallet', label: 'Wallet Ledger', icon: <Wallet className="w-4 h-4" /> },
    ],
  },
  {
    section: 'PRICING',
    items: [
      { id: 'pricing', label: 'Pricing Rules', icon: <Percent className="w-4 h-4" /> },
      { id: 'surge', label: 'Surge Rules', icon: <TrendingUp className="w-4 h-4" /> },
      { id: 'commission', label: 'Commission', icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    section: 'GROWTH',
    items: [
      { id: 'promotions', label: 'Promotions', icon: <Gift className="w-4 h-4" /> },
      { id: 'sponsored', label: 'Sponsored', icon: <Star className="w-4 h-4" /> },
    ],
  },
  {
    section: 'SAFETY & RISK',
    items: [
      { id: 'risk', label: 'Risk Dashboard', icon: <Shield className="w-4 h-4" /> },
      { id: 'fraud', label: 'Fraud Flags', icon: <Flag className="w-4 h-4" /> },
      { id: 'safety', label: 'Safety Incidents', icon: <HeartHandshake className="w-4 h-4" /> },
      { id: 'kyc', label: 'KYC / Documents', icon: <FileCheck className="w-4 h-4" /> },
    ],
  },
  {
    section: 'SUPPORT',
    items: [
      { id: 'support', label: 'Support Dashboard', icon: <Headphones className="w-4 h-4" /> },
      { id: 'tickets', label: 'All Tickets', icon: <MessageSquare className="w-4 h-4" /> },
    ],
  },
  {
    section: 'ANALYTICS',
    items: [
      { id: 'analytics', label: 'Business Analytics', icon: <PieChart className="w-4 h-4" /> },
      { id: 'unit-economics', label: 'Unit Economics', icon: <DollarSign className="w-4 h-4" /> },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { id: 'admin-users', label: 'Admin Users', icon: <UserCog className="w-4 h-4" /> },
      { id: 'roles', label: 'Roles & Permissions', icon: <Key className="w-4 h-4" /> },
      { id: 'audit-logs', label: 'Audit Logs', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'system', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  currentUser?: {
    name?: string;
    email?: string;
    role?: string;
    avatar?: string;
  } | null;
}

export default function Sidebar({ currentPage, onNavigate, currentUser }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { canViewPage, isSuperAdmin, roleName } = usePermissions();
  const { badgeCounts } = useBadges();

  const userName = currentUser?.name || 'Ashish Agarwal';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AA';

  const getDynamicBadge = (id: string): number | string | undefined => {
    switch (id) {
      case 'notifications':
        return badgeCounts.notifications > 0 ? badgeCounts.notifications : undefined;
      case 'live-jobs':
        return badgeCounts.liveJobs > 0 ? badgeCounts.liveJobs : undefined;
      case 'refunds':
        return badgeCounts.refunds > 0 ? badgeCounts.refunds : undefined;
      case 'reconciliation':
        return badgeCounts.reconciliation > 0 ? badgeCounts.reconciliation : undefined;
      case 'fraud':
        return badgeCounts.fraud > 0 ? badgeCounts.fraud : undefined;
      case 'kyc':
        return badgeCounts.kyc > 0 ? badgeCounts.kyc : undefined;
      case 'tickets':
        return badgeCounts.tickets > 0 ? badgeCounts.tickets : undefined;
      case 'partners':
      case 'riders':
        return badgeCounts.pendingRiders > 0 ? badgeCounts.pendingRiders : undefined;
      default:
        return undefined;
    }
  };

  // Filter groups: keep only items the user can view, map dynamic badges, drop empty groups
  const filteredNav = NAV.map(group => ({
    ...group,
    items: group.items
      .filter(item => canViewPage(item.id))
      .map(item => ({
        ...item,
        badge: getDynamicBadge(item.id),
      })),
  })).filter(group => group.items.length > 0);

  return (
    <div
      className="flex flex-col h-full bg-black transition-all duration-200"
      style={{ width: collapsed ? 52 : 220, flexShrink: 0 }}
    >
      {/* Official RoadRider Brand Logo */}
      <div className={`flex items-center ${collapsed ? 'flex-col gap-2 justify-center py-3 px-1' : 'justify-between px-3.5 py-3.5'} border-b border-white/10`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src="/roadrider-delivery-logo.png"
              alt="RoadRider"
              className="h-6 w-auto max-w-[42px] object-contain select-none"
            />
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Expand Sidebar"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center min-w-0 pr-2">
              <img
                src="/roadrider-delivery-logo.png"
                alt="RoadRider - Aapke Safar Ka Saarthi"
                className="h-8 max-w-[145px] w-auto object-contain select-none"
              />
            </div>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors ml-auto flex-shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Role badge (when expanded) */}
      {!collapsed && !isSuperAdmin && (
        <div className="px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-white/30 flex-shrink-0" />
            <span className="text-[10px] text-white/40 truncate">{roleName} — restricted view</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 scrollable">
        {filteredNav.map(group => (
          <div key={group.section} className="mb-4">
            {!collapsed && (
              <p className="px-4 pb-1 text-[10px] font-bold tracking-widest"
                style={{ color: '#464646' }}>
                {group.section}
              </p>
            )}
            {group.items.map(item => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`relative w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                    ${isActive ? 'nav-active text-white bg-white/8' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-[#A35E47]' : ''}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="text-xs font-medium flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                          ${typeof item.badge === 'string'
                            ? 'bg-[#A35E47] text-white'
                            : 'bg-white/15 text-white/80'}`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#A35E47] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-white/40 truncate">{roleName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
