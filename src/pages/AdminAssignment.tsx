import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, Edit2, Trash2, Shield, Eye, EyeOff, Check, X, ChevronDown,
  Save, AlertTriangle, Search, MoreVertical, UserCheck, Key, Copy, Mail,
  CheckSquare, Square, Lock, Unlock, RefreshCw
} from 'lucide-react';
import { ROLE_PRESETS } from '../types/permissions';
import type { Module, Permission, RolePermissions } from '../types/permissions';
import { usePermissions } from '../context/PermissionsContext';
import { subAdminApi } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────
interface SubAdmin {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  roleId: string;
  role: string;
  department: string;
  cityAccess: string;
  avatar: string;
  status: 'Active' | 'Suspended' | 'Pending';
  permissions: RolePermissions;
  createdAt: string;
  lastActive: string;
  createdBy: string;
}

// ─── Constants ────────────────────────────────────────────────────────
const STORAGE_KEY = 'rr_sub_admins';
const MODULES: { key: Module; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'customers', label: 'Customers' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'partners', label: 'Partners' },
  { key: 'orders', label: 'Orders' },
  { key: 'finance', label: 'Finance' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'risk', label: 'Risk' },
  { key: 'system', label: 'System' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'support', label: 'Support' },
  { key: 'kyc', label: 'KYC' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'cities', label: 'Cities' },
];
const PERMISSIONS_LIST: { key: Permission; label: string; short: string }[] = [
  { key: 'view', label: 'View', short: 'VIEW' },
  { key: 'create', label: 'Create', short: 'CREATE' },
  { key: 'edit', label: 'Edit', short: 'EDIT' },
  { key: 'approve', label: 'Approve', short: 'APPROVE' },
  { key: 'reject', label: 'Reject', short: 'REJECT' },
  { key: 'refund', label: 'Refund', short: 'REFUND' },
  { key: 'suspend', label: 'Suspend', short: 'SUSPEND' },
  { key: 'config', label: 'Config', short: 'CONFIG' },
  { key: 'export', label: 'Export', short: 'EXPORT' },
];

const DEPT_OPTIONS = [
  'Executive Operations', 'Ground Operations', 'Finance & Treasury',
  'Trust & Safety', 'Customer Experience', 'City Expansion',
  'Product', 'Tech', 'Auditing',
];

const CITY_OPTIONS = [
  'Lucknow',
  'Lucknow — Zone A',
  'Lucknow — Zone B',
  'Lucknow — Zone C',
  'Lucknow — Zone D',
  'Lucknow — Zone E',
  'Lucknow — All Zones',
];

// ─── Helpers ──────────────────────────────────────────────────────────
function loadAdmins(): SubAdmin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveAdmins(list: SubAdmin[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function initPerms(): RolePermissions {
  const p: RolePermissions = {};
  MODULES.forEach(m => { p[m.key] = {}; });
  return p;
}
function presetToPerms(presetId: string): RolePermissions {
  const preset = ROLE_PRESETS[presetId];
  if (!preset) return initPerms();
  const merged = initPerms();
  Object.keys(merged).forEach(k => {
    const mod = k as Module;
    merged[mod] = preset.permissions[mod] ? { ...preset.permissions[mod] } : {};
  });
  return merged;
}
function genId() { return 'ADM-' + Math.random().toString(36).substring(2, 6).toUpperCase(); }
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SA';
}

// ─── Permission Matrix Component ─────────────────────────────────────
function PermMatrix({
  permissions,
  onChange,
  readOnly = false,
}: {
  permissions?: RolePermissions | null;
  onChange?: (p: RolePermissions) => void;
  readOnly?: boolean;
}) {
  const safePermissions: RolePermissions = (permissions && typeof permissions === 'object') ? permissions : {};

  const toggle = (mod: Module, perm: Permission) => {
    if (readOnly || !onChange) return;
    const updated = { ...safePermissions };
    const currentMod = updated[mod] && typeof updated[mod] === 'object' ? updated[mod] : {};
    updated[mod] = { ...currentMod, [perm]: !currentMod[perm] };
    // If disabling view, disable all others too
    if (perm === 'view' && !updated[mod]!.view) {
      updated[mod] = {};
    }
    // If enabling any permission, also enable view
    if (perm !== 'view' && updated[mod]?.[perm]) {
      updated[mod] = { ...updated[mod], view: true };
    }
    onChange(updated);
  };

  const toggleAll = (mod: Module, enable: boolean) => {
    if (readOnly || !onChange) return;
    const updated = { ...safePermissions };
    if (enable) {
      const all: RolePermissions[Module] = {};
      PERMISSIONS_LIST.forEach(p => { all![p.key] = true; });
      updated[mod] = all;
    } else {
      updated[mod] = {};
    }
    onChange(updated);
  };

  const isAllEnabled = (mod: Module) => {
    const modPerms = safePermissions[mod];
    if (!modPerms || typeof modPerms !== 'object') return false;
    return PERMISSIONS_LIST.every(p => !!modPerms[p.key]);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8E8E8]">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className="border-b border-[#E8E8E8]">
            <th className="text-left px-4 py-3 text-[10px] font-bold tracking-widest text-[#9C9A9A] w-32 bg-[#FAFAFA]">
              MODULE
            </th>
            {PERMISSIONS_LIST.map(p => (
              <th key={p.key} className="px-2 py-3 text-[10px] font-bold tracking-widest text-[#9C9A9A] text-center bg-[#FAFAFA]">
                {p.short}
              </th>
            ))}
            {!readOnly && (
              <th className="px-2 py-3 text-[10px] font-bold tracking-widest text-[#9C9A9A] text-center bg-[#FAFAFA] w-16">
                ALL
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod, i) => {
            const modPerms: any = safePermissions[mod.key] && typeof safePermissions[mod.key] === 'object' ? safePermissions[mod.key] : {};
            const hasAny = Object.values(modPerms).some(Boolean);
            return (
              <tr key={mod.key} className={`border-b border-[#F0F0F0] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]/50'} ${!readOnly ? 'hover:bg-[#FFF8F6]' : ''} transition-colors`}>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-semibold ${hasAny ? 'text-black' : 'text-[#9C9A9A]'}`}>
                    {mod.label}
                  </span>
                </td>
                {PERMISSIONS_LIST.map(perm => {
                  const enabled = !!modPerms[perm.key];
                  const isViewDisabled = perm.key !== 'view' && !modPerms.view && !readOnly;
                  return (
                    <td key={perm.key} className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(mod.key, perm.key)}
                        disabled={readOnly || isViewDisabled}
                        title={isViewDisabled ? 'Enable View first' : enabled ? `Revoke ${perm.label}` : `Grant ${perm.label}`}
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-all
                          ${readOnly
                            ? enabled ? 'bg-black' : 'bg-[#F0F0F0]'
                            : enabled
                              ? 'bg-black hover:bg-[#333] cursor-pointer shadow-sm'
                              : isViewDisabled
                                ? 'bg-[#F5F5F5] cursor-not-allowed opacity-40'
                                : 'bg-[#F0F0F0] hover:bg-[#E0E0E0] cursor-pointer border border-[#D8D8D8]'
                          }`}
                      >
                        {enabled
                          ? <Check className="w-3 h-3 text-white" />
                          : <span className="w-3 h-3 flex items-center justify-center text-[#B0B0B0] text-[10px] font-bold">—</span>
                        }
                      </button>
                    </td>
                  );
                })}
                {!readOnly && (
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleAll(mod.key, !isAllEnabled(mod.key))}
                      className="text-[10px] font-bold text-[#A35E47] hover:underline cursor-pointer"
                    >
                      {isAllEnabled(mod.key) ? 'None' : 'All'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub Admin Form (Create / Edit) ──────────────────────────────────
function AdminForm({
  initial,
  onSave,
  onCancel,
  createdBy,
}: {
  initial?: Partial<SubAdmin>;
  onSave: (admin: SubAdmin) => void;
  onCancel: () => void;
  createdBy: string;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [dept, setDept] = useState(initial?.department || 'Ground Operations');
  const [city, setCity] = useState(initial?.cityAccess || 'Lucknow');
  const [selectedPreset, setSelectedPreset] = useState(initial?.roleId || 'operations_manager');
  const [permissions, setPermissions] = useState<RolePermissions>(
    initial?.permissions || presetToPerms('operations_manager')
  );
  const [status, setStatus] = useState<SubAdmin['status']>(initial?.status || 'Active');
  const [error, setError] = useState('');

  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setPermissions(presetToPerms(presetId));
  };

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Valid email is required'); return; }
    if (!initial?.id && (!password || password.length < 6)) {
      setError('Initial password must be at least 6 characters');
      return;
    }
    const rolePreset = ROLE_PRESETS[selectedPreset];
    const admin: SubAdmin = {
      id: initial?.id || genId(),
      name: name.trim(),
      email: email.trim(),
      phone,
      password: password || undefined,
      roleId: selectedPreset,
      role: rolePreset?.name || 'Custom Role',
      department: dept,
      cityAccess: city,
      avatar: initials(name.trim()),
      status,
      permissions,
      createdAt: initial?.createdAt || new Date().toLocaleDateString('en-IN'),
      lastActive: initial?.lastActive || 'Never',
      createdBy,
    };
    onSave(admin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0] bg-black text-white">
          <div>
            <h2 className="font-black text-lg tracking-tight">
              {initial?.id ? 'Edit Admin User' : 'Create New Admin User'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5">
              {initial?.id ? `Editing ${initial.name}` : 'Assign role & permissions for the new admin'}
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Basic Info */}
          <div>
            <h3 className="text-xs font-bold text-[#9C9A9A] uppercase tracking-widest mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[#464646] mb-1.5">Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black transition-colors"
                  placeholder="e.g. Priya Gupta" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#464646] mb-1.5">Email Address *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black transition-colors"
                  placeholder="priya@roadrider.in" />
              </div>
              {!initial?.id && (
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-[#464646] mb-1.5">
                    Initial Login Password * <span className="text-[#9C9A9A] font-normal">(min 6 characters)</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black transition-colors"
                    placeholder="Enter secure initial password for sub-admin login"
                  />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold text-[#464646] mb-1.5">Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black transition-colors"
                  placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#464646] mb-1.5">Department</label>
                <select value={dept} onChange={e => setDept(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black bg-white">
                  {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#464646] mb-1.5">City Access</label>
                <select value={city} onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black bg-white">
                  {CITY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#464646] mb-1.5">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as SubAdmin['status'])}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-black bg-white">
                  <option>Active</option>
                  <option>Suspended</option>
                  <option>Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Role Preset */}
          <div>
            <h3 className="text-xs font-bold text-[#9C9A9A] uppercase tracking-widest mb-3">
              Start from a Role Template <span className="text-[#A35E47]">(then customize below)</span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(ROLE_PRESETS).filter(r => r.id !== 'super_admin').map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                    ${selectedPreset === preset.id
                      ? 'border-black bg-black text-white shadow-md'
                      : 'border-[#E8E8E8] hover:border-[#464646] bg-white'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: preset.color }} />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${selectedPreset === preset.id ? 'text-white' : 'text-black'}`}>
                      {preset.name}
                    </p>
                    <p className={`text-[10px] truncate ${selectedPreset === preset.id ? 'text-white/60' : 'text-[#9C9A9A]'}`}>
                      {preset.description.slice(0, 40)}…
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Permission Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#9C9A9A] uppercase tracking-widest">
                Permission Matrix <span className="text-[#A35E47]">— toggle each cell to customize</span>
              </h3>
              <button
                type="button"
                onClick={() => setPermissions(initPerms())}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9C9A9A] hover:text-red-600 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Clear all
              </button>
            </div>
            <PermMatrix permissions={permissions} onChange={setPermissions} />
            <p className="text-[10px] text-[#9C9A9A] mt-2">
              💡 Enabling any permission auto-enables View. Disabling View removes all permissions for that module.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA]">
          <button onClick={onCancel}
            className="px-5 py-2.5 text-sm font-semibold text-[#464646] border border-[#E8E8E8] rounded-xl hover:bg-[#F0F0F0] transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-[#333] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-lg">
            <Save className="w-4 h-4" />
            {initial?.id ? 'Save Changes' : 'Create Admin & Assign Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View Permissions Modal ───────────────────────────────────────────
function ViewPermsModal({ admin, onClose }: { admin: SubAdmin; onClose: () => void }) {
  const preset = ROLE_PRESETS[admin.roleId];
  const color = preset?.color || '#464646';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white text-sm font-black">
              {admin.avatar}
            </div>
            <div>
              <h2 className="font-black text-base">{admin.name}'s Permissions</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: color + '20', color: color }}>
                  {admin.role}
                </span>
                <span className="text-xs text-[#9C9A9A]">{admin.department}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F0F0F0] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <PermMatrix permissions={admin.permissions} readOnly />
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────
function ResetPasswordModal({
  admin,
  onReset,
  onCancel,
}: {
  admin: SubAdmin;
  onReset: (newPassword: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onReset(password);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="w-5 h-5 text-amber-700" />
        </div>
        <h3 className="font-black text-center text-base mb-1">Reset Password for {admin.name}</h3>
        <p className="text-xs text-[#9C9A9A] text-center mb-4">
          Set a secure initial or replacement password for {admin.email}
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#464646] mb-1">New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-xl outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#464646] mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-xl outline-none focus:border-black"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 border border-[#E8E8E8] rounded-xl text-sm font-semibold text-[#464646] hover:bg-[#F5F5F5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-black hover:bg-[#333] rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function AdminAssignment() {
  const { isSuperAdmin, can } = usePermissions();
  const [admins, setAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editAdmin, setEditAdmin] = useState<SubAdmin | undefined>();
  const [viewAdmin, setViewAdmin] = useState<SubAdmin | undefined>();
  const [resetAdmin, setResetAdmin] = useState<SubAdmin | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const currentUser = JSON.parse(localStorage.getItem('rr_auth_user') || '{}');
  const canManage = isSuperAdmin;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadSubAdmins = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await subAdminApi.getAll();
      setAdmins(data as any[]);
    } catch (err: any) {
      console.error('[AdminAssignment] Error loading sub-admins:', err);
      setFetchError(err.message || 'Failed to load sub-admin records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubAdmins();
  }, []);

  const handleSave = async (admin: SubAdmin) => {
    try {
      await subAdminApi.create({
        name: admin.name,
        email: admin.email,
        password: admin.password,
        role: admin.role,
        department: admin.department,
        cityAccess: admin.cityAccess,
        permissions: admin.permissions,
      });
      showToast(editAdmin ? `${admin.name}'s permissions updated` : `✅ ${admin.name} created & assigned`);
      setShowForm(false);
      setEditAdmin(undefined);
      loadSubAdmins();
    } catch (err: any) {
      showToast(`❌ Failed to save admin: ${err.message}`);
    }
  };

  const handleDelete = (id: string) => {
    setAdmins(prev => prev.filter(a => a.id !== id));
    setDeleteConfirm(null);
    showToast('Admin user removed');
  };

  const toggleStatus = async (admin: SubAdmin) => {
    if (admin.email?.toLowerCase() === 'techroadrider@gmail.com') {
      showToast('❌ Super Admin account cannot be suspended');
      return;
    }
    try {
      await subAdminApi.toggleStatus(admin.id, admin.status);
      showToast(`✅ ${admin.name} ${admin.status === 'Active' ? 'suspended' : 'activated'}`);
      loadSubAdmins();
    } catch (err: any) {
      showToast(`❌ Failed to update status: ${err.message}`);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!resetAdmin) return;
    try {
      await subAdminApi.resetPassword(resetAdmin.id, resetAdmin.email, newPassword);
      showToast(`✅ Password for ${resetAdmin.name} updated successfully`);
      setResetAdmin(undefined);
    } catch (err: any) {
      throw err;
    }
  };

  const copyLoginHint = (admin: SubAdmin) => {
    const hint = `Email: ${admin.email} | Role: ${admin.role}`;
    navigator.clipboard.writeText(hint).catch(() => {});
    showToast('Login details copied');
  };

  const filtered = admins.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  // Permission summary for a card
  const permSummary = (perms?: RolePermissions | null) => {
    if (!perms || typeof perms !== 'object') return 0;
    const modules = Object.entries(perms).filter(([, v]) =>
      v && typeof v === 'object' && Object.values(v).some(Boolean)
    );
    return modules.length;
  };

  const totalPerms = (perms?: RolePermissions | null) => {
    if (!perms || typeof perms !== 'object') return 0;
    return Object.values(perms).reduce((acc, mod) => {
      if (!mod || typeof mod !== 'object') return acc;
      return acc + Object.values(mod).filter(Boolean).length;
    }, 0);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center mt-12">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-black text-black mb-2">Super Admin Access Only</h2>
        <p className="text-sm text-[#9C9A9A] max-w-md mx-auto mb-6">
          Sub-Admin account management, role assignment, and credential controls are restricted exclusively to Super Admin Ashish Agarwal.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight">Admin User Management</h1>
          <p className="text-sm text-[#9C9A9A] mt-1">
            Assign sub-admins and control exactly which modules and actions they can access
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setEditAdmin(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-[#333] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-lg"
          >
            <Plus className="w-4 h-4" /> Assign New Admin
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Admins', value: admins.length, color: 'bg-black text-white' },
          { label: 'Active', value: admins.filter(a => a.status === 'Active').length, color: 'bg-green-50 text-green-700 border border-green-200' },
          { label: 'Suspended', value: admins.filter(a => a.status === 'Suspended').length, color: 'bg-red-50 text-red-700 border border-red-200' },
          { label: 'Pending Setup', value: admins.filter(a => a.status === 'Pending').length, color: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl px-4 py-3 ${stat.color}`}>
            <p className="text-2xl font-black">{stat.value}</p>
            <p className="text-xs font-semibold opacity-70 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C9A9A]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="w-full pl-10 pr-4 py-2.5 border border-[#E8E8E8] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      {/* Admin Cards */}
      {loading ? (
        <div className="border border-[#E8E8E8] rounded-xl p-16 text-center bg-white my-4">
          <RefreshCw className="w-6 h-6 animate-spin text-[#A35E47] mx-auto mb-2" />
          <p className="text-xs text-[#464646] font-bold">Loading sub-admin accounts from Supabase...</p>
        </div>
      ) : fetchError ? (
        <div className="border border-red-200 bg-red-50 rounded-xl p-8 text-center my-4 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-xs font-bold mb-1">Failed to Load Sub-Admins</p>
          <p className="text-[11px] text-red-600 mb-4">{fetchError}</p>
          <button
            onClick={loadSubAdmins}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#FAFAFA] rounded-2xl border border-dashed border-[#E0E0E0]">
          <UserCheck className="w-12 h-12 text-[#D0D0D0] mx-auto mb-3" />
          <p className="font-bold text-[#464646]">No sub-admins yet</p>
          <p className="text-sm text-[#9C9A9A] mt-1">Click "Assign New Admin" to create your first sub-admin with custom permissions</p>
          {canManage && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-bold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Assign New Admin
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(admin => {
            const preset = ROLE_PRESETS[admin.roleId];
            const color = preset?.color || '#464646';
            const adminPerms = (admin.permissions && typeof admin.permissions === 'object') ? admin.permissions : {};
            const mods = permSummary(adminPerms);
            const perms = totalPerms(adminPerms);
            return (
              <div key={admin.id}
                className="bg-white border border-[#F0F0F0] rounded-2xl p-5 hover:border-[#D0D0D0] hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: identity */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                      style={{ background: color }}>
                      {admin.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-black">{admin.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                          ${admin.status === 'Active' ? 'bg-green-100 text-green-700'
                            : admin.status === 'Suspended' ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'}`}>
                          {admin.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#9C9A9A] mt-0.5">{admin.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: color + '18', color }}>
                          {admin.role}
                        </span>
                        <span className="text-[10px] text-[#9C9A9A]">{admin.department}</span>
                        <span className="text-[10px] text-[#9C9A9A]">· {admin.cityAccess}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: stats + actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Permission Summary Chips */}
                    <div className="hidden md:flex items-center gap-2 text-[11px]">
                      {mods > 0 ? (
                        <>
                          <div className="text-center px-3 py-1.5 bg-[#F5F5F5] rounded-lg">
                            <p className="font-black text-black text-sm">{mods}</p>
                            <p className="text-[#9C9A9A] text-[10px]">modules</p>
                          </div>
                          <div className="text-center px-3 py-1.5 bg-[#F5F5F5] rounded-lg">
                            <p className="font-black text-black text-sm">{perms}</p>
                            <p className="text-[#9C9A9A] text-[10px]">permissions</p>
                          </div>
                        </>
                      ) : (
                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200/60 rounded-lg text-amber-800 text-[11px] font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>No permissions assigned</span>
                        </div>
                      )}
                      <div className="text-center px-3 py-1.5 bg-[#F5F5F5] rounded-lg">
                        <p className="font-bold text-[#464646] text-[11px]">{admin.lastActive}</p>
                        <p className="text-[#9C9A9A] text-[10px]">last active</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewAdmin(admin)}
                        className="p-2 rounded-lg text-[#9C9A9A] hover:text-black hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                        title="View permissions"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => { setEditAdmin(admin); setShowForm(true); }}
                            className="p-2 rounded-lg text-[#9C9A9A] hover:text-black hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                            title="Edit permissions"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(admin)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer
                              ${admin.status === 'Active'
                                ? 'text-[#9C9A9A] hover:text-red-600 hover:bg-red-50'
                                : 'text-[#9C9A9A] hover:text-green-600 hover:bg-green-50'}`}
                            title={admin.status === 'Active' ? 'Suspend admin' : 'Activate admin'}
                          >
                            {admin.status === 'Active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setResetAdmin(admin)}
                            className="p-2 rounded-lg text-[#9C9A9A] hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Reset password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => copyLoginHint(admin)}
                            className="p-2 rounded-lg text-[#9C9A9A] hover:text-black hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                            title="Copy login details"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(admin.id)}
                            className="p-2 rounded-lg text-[#9C9A9A] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove admin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mini permission preview bar */}
                <div className="mt-4 pt-4 border-t border-[#F5F5F5]">
                  <p className="text-[10px] font-bold text-[#9C9A9A] uppercase tracking-widest mb-2">Module Access</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MODULES.map(mod => {
                      const modPerms = adminPerms[mod.key];
                      const hasView = !!modPerms?.view;
                      const permCount = (modPerms && typeof modPerms === 'object') ? Object.values(modPerms).filter(Boolean).length : 0;
                      if (!hasView) return null;
                      return (
                        <span key={mod.key}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F0F0F0] text-[#464646]">
                          {mod.label}
                          <span className="text-[#9C9A9A] font-normal">·{permCount}</span>
                        </span>
                      );
                    })}
                    {MODULES.every(m => !adminPerms[m.key]?.view) && (
                      <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" /> No permissions assigned
                      </span>
                    )}
                  </div>
                </div>

                {/* Created by */}
                <p className="text-[10px] text-[#C0C0C0] mt-3">
                  Created {admin.createdAt} by {admin.createdBy} · ID: {admin.id}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-black text-center text-base mb-1">Remove Admin User?</h3>
            <p className="text-sm text-[#9C9A9A] text-center mb-5">
              This will permanently revoke their access. They will be logged out on next session refresh.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-[#E8E8E8] rounded-xl text-sm font-semibold text-[#464646] hover:bg-[#F5F5F5] cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold text-white cursor-pointer">
                Remove Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Permissions Modal */}
      {viewAdmin && <ViewPermsModal admin={viewAdmin} onClose={() => setViewAdmin(undefined)} />}

      {/* Reset Password Modal */}
      {resetAdmin && (
        <ResetPasswordModal
          admin={resetAdmin}
          onReset={handleResetPassword}
          onCancel={() => setResetAdmin(undefined)}
        />
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <AdminForm
          initial={editAdmin}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditAdmin(undefined); }}
          createdBy={currentUser?.name || 'Super Admin'}
        />
      )}
    </div>
  );
}
