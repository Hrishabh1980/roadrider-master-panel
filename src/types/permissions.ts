// ─────────────────────────────────────────────────────────────────────
//  RoadRider RBAC — Permission Types & Role Presets
// ─────────────────────────────────────────────────────────────────────

export type Permission =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'refund'
  | 'suspend'
  | 'config'
  | 'export';

export type Module =
  | 'dashboard'
  | 'customers'
  | 'vendors'
  | 'partners'
  | 'vehicles'
  | 'operations'
  | 'orders'
  | 'marketplace'
  | 'cities'
  | 'finance'
  | 'pricing'
  | 'promotions'
  | 'risk'
  | 'kyc'
  | 'support'
  | 'analytics'
  | 'system';

export type ModulePermissions = Partial<Record<Permission, boolean>>;
export type RolePermissions = Partial<Record<Module, ModulePermissions>>;

export interface AdminRole {
  id: string;
  name: string;
  color: string;
  description: string;
  permissions: RolePermissions;
}

// ─── All permissions ON (Super Admin) ────────────────────────────────
const ALL: ModulePermissions = {
  view: true, create: true, edit: true, approve: true,
  reject: true, refund: true, suspend: true, config: true, export: true,
};

// ─── Built-in role presets ────────────────────────────────────────────
export const ROLE_PRESETS: Record<string, AdminRole> = {
  super_admin: {
    id: 'super_admin',
    name: 'Super Admin',
    color: '#A35E47',
    description: 'Unrestricted access to all modules and actions',
    permissions: {
      dashboard: ALL,
      customers: ALL,
      vendors: ALL,
      partners: ALL,
      vehicles: ALL,
      operations: ALL,
      orders: ALL,
      marketplace: ALL,
      cities: ALL,
      finance: ALL,
      pricing: ALL,
      promotions: ALL,
      risk: ALL,
      kyc: ALL,
      support: ALL,
      analytics: ALL,
      system: ALL,
    },
  },

  operations_manager: {
    id: 'operations_manager',
    name: 'Operations Manager',
    color: '#3B82F6',
    description: 'Manages day-to-day ride, delivery, and partner operations',
    permissions: {
      dashboard: { view: true, export: true },
      customers: { view: true, edit: true, suspend: true },
      vendors: { view: true, edit: true, suspend: true },
      partners: { view: true, edit: true, approve: true, reject: true, suspend: true },
      vehicles: { view: true, edit: true },
      operations: { view: true, create: true, edit: true },
      orders: { view: true, edit: true, approve: true, reject: true },
      marketplace: { view: true },
      cities: { view: true, edit: true },
      analytics: { view: true, export: true },
      support: { view: true },
    },
  },

  finance_manager: {
    id: 'finance_manager',
    name: 'Finance Manager',
    color: '#10B981',
    description: 'Manages transactions, payouts, refunds and reconciliation',
    permissions: {
      dashboard: { view: true },
      finance: { view: true, approve: true, reject: true, refund: true, export: true },
      analytics: { view: true, export: true },
      pricing: { view: true, edit: true, config: true },
      promotions: { view: true, create: true, edit: true },
    },
  },

  risk_analyst: {
    id: 'risk_analyst',
    name: 'Risk Analyst',
    color: '#EF4444',
    description: 'Reviews fraud flags, KYC documents, and safety incidents',
    permissions: {
      dashboard: { view: true },
      customers: { view: true, suspend: true },
      vendors: { view: true, suspend: true },
      partners: { view: true, suspend: true },
      orders: { view: true },
      risk: { view: true, edit: true, approve: true, reject: true, suspend: true, export: true },
      kyc: { view: true, approve: true, reject: true, export: true },
      analytics: { view: true },
    },
  },

  support_agent: {
    id: 'support_agent',
    name: 'Support Agent',
    color: '#8B5CF6',
    description: 'Handles customer support tickets and basic account queries',
    permissions: {
      dashboard: { view: true },
      customers: { view: true },
      vendors: { view: true },
      partners: { view: true },
      orders: { view: true },
      support: { view: true, create: true, edit: true, approve: true },
      finance: { view: true, refund: true },
    },
  },

  city_manager: {
    id: 'city_manager',
    name: 'City Manager',
    color: '#F59E0B',
    description: 'Manages city-level operations, service zones and pricing',
    permissions: {
      dashboard: { view: true },
      cities: { view: true, create: true, edit: true, config: true },
      marketplace: { view: true, create: true, edit: true, approve: true },
      pricing: { view: true, edit: true },
      promotions: { view: true, create: true },
      analytics: { view: true, export: true },
      vendors: { view: true, approve: true },
      partners: { view: true },
    },
  },

  viewer: {
    id: 'viewer',
    name: 'Read-Only Viewer',
    color: '#6B7280',
    description: 'Can view all modules but cannot perform any actions',
    permissions: {
      dashboard: { view: true },
      customers: { view: true },
      vendors: { view: true },
      partners: { view: true },
      vehicles: { view: true },
      operations: { view: true },
      orders: { view: true },
      marketplace: { view: true },
      cities: { view: true },
      finance: { view: true },
      pricing: { view: true },
      promotions: { view: true },
      risk: { view: true },
      kyc: { view: true },
      support: { view: true },
      analytics: { view: true },
    },
  },
};

// ─── Helper: map page/nav IDs → Module ───────────────────────────────
export const PAGE_TO_MODULE: Record<string, Module> = {
  dashboard: 'dashboard',
  notifications: 'dashboard',

  customers: 'customers',

  vendors: 'vendors',

  partners: 'partners',
  riders: 'partners',
  vehicles: 'vehicles',

  'live-jobs': 'operations',
  orders: 'orders',
  rides: 'orders',
  courier: 'orders',
  dispatch: 'operations',
  slots: 'operations',

  restaurants: 'marketplace',
  'grocery-stores': 'marketplace',
  products: 'marketplace',
  categories: 'marketplace',
  cities: 'cities',
  'service-availability': 'cities',

  finance: 'finance',
  transactions: 'finance',
  payments: 'finance',
  refunds: 'finance',
  payouts: 'finance',
  reconciliation: 'finance',
  wallet: 'finance',

  pricing: 'pricing',
  surge: 'pricing',
  commission: 'pricing',

  promotions: 'promotions',
  sponsored: 'promotions',

  risk: 'risk',
  fraud: 'risk',
  safety: 'risk',
  kyc: 'kyc',

  support: 'support',
  tickets: 'support',

  analytics: 'analytics',
  'unit-economics': 'analytics',

  'admin-users': 'system',
  roles: 'system',
  'audit-logs': 'system',
  system: 'system',
};
