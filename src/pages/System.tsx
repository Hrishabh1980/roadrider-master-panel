import React, { useState } from 'react';
import { SectionHeader, DataTable, Badge, Btn, Tabs, PermRow } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { systemApi } from '../services/api';
import { isSupabaseConfigured, SUPABASE_URL } from '../services/supabase';
import { RefreshCw } from 'lucide-react';

export default function System({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [tab, setTab] = useState('Admin Users');
  const tabs = ['Admin Users', 'Roles & Permissions', 'Audit Logs', 'System Settings'];

  const { data: adminsData, loading: loadingAdmins, refetch: refetchAdmins } = useApi(
    () => systemApi.getAdminUsers(),
    []
  );

  const { data: auditResponse, loading: loadingAudit, refetch: refetchAudit } = useApi(
    () => systemApi.getAuditLogs(),
    { data: [], total: 0 }
  );

  const adminUsers = adminsData || [];
  const auditLogs = auditResponse?.data || [];

  const userColumns = [
    { key: 'id', label: 'ADMIN ID', width: '120px' },
    { key: 'name', label: 'NAME' },
    { key: 'role', label: 'ROLE' },
    { key: 'email', label: 'EMAIL' },
    { key: 'status', label: 'STATUS', width: '90px' },
    { key: 'lastActive', label: 'LAST ACTIVE' },
  ];

  const userRows = adminUsers.map((u: any) => ({
    ...u,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{u.id?.slice(0, 8)}...</span>,
    name: <span className="font-semibold">{u.name}</span>,
    role: (
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${u.role === 'Super Admin' ? 'bg-black text-white' : 'bg-[#F0F0F0] text-[#464646]'}`}>
        {u.role}
      </span>
    ),
    status: <Badge variant={u.status?.toLowerCase() || 'active'} label={u.status || 'Active'} showDot />,
  }));

  const auditColumns = [
    { key: 'id', label: 'LOG ID', width: '90px' },
    { key: 'timestamp', label: 'TIMESTAMP', width: '150px' },
    { key: 'action', label: 'ACTION' },
    { key: 'entity', label: 'ENTITY', width: '100px' },
    { key: 'user', label: 'ADMIN / USER' },
    { key: 'ip', label: 'IP ADDRESS' },
    { key: 'details', label: 'DETAILS' },
  ];

  const auditRows = auditLogs.map((a: any) => ({
    ...a,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{a.id}</span>,
    action: <span className="font-bold">{a.action}</span>,
    entity: <span className="text-xs font-semibold">{a.entity}</span>,
    user: <span className="text-xs font-mono-data text-[#9C9A9A]">{a.user}</span>,
    ip: <span className="text-xs font-mono-data text-[#9C9A9A]">{a.ip}</span>,
    timestamp: <span className="text-xs text-[#9C9A9A]">{a.timestamp}</span>,
    details: <span className="text-xs text-[#464646] font-mono-data truncate max-w-xs block">{a.details}</span>,
  }));

  const PERMISSIONS = [
    { module: 'Dashboard', view: true, create: false, edit: false, approve: false, reject: false, refund: false, suspend: false, configure: false, export: true },
    { module: 'Customers', view: true, create: true, edit: true, approve: false, reject: false, refund: true, suspend: true, configure: false, export: true },
    { module: 'Vendors', view: true, create: true, edit: true, approve: true, reject: true, refund: false, suspend: true, configure: false, export: true },
    { module: 'Partners', view: true, create: true, edit: true, approve: true, reject: true, refund: false, suspend: true, configure: false, export: true },
    { module: 'Orders', view: true, create: false, edit: false, approve: false, reject: false, refund: true, suspend: false, configure: false, export: true },
    { module: 'Finance', view: true, create: false, edit: false, approve: true, reject: true, refund: true, suspend: false, configure: false, export: true },
    { module: 'Pricing', view: true, create: true, edit: true, approve: true, reject: true, refund: false, suspend: false, configure: true, export: false },
    { module: 'Risk', view: true, create: false, edit: true, approve: false, reject: false, refund: false, suspend: true, configure: false, export: true },
    { module: 'System', view: true, create: true, edit: true, approve: false, reject: false, refund: false, suspend: false, configure: true, export: false },
  ];

  const SETTINGS_SECTIONS = [
    {
      title: 'Platform Infrastructure', items: [
        { label: 'Platform Name', value: 'RoadRider Production Console', type: 'text' },
        { label: 'Operating Hub', value: 'Lucknow Municipal Region', type: 'text' },
        { label: 'Master Admin Account', value: 'techroadrider@gmail.com', type: 'text' },
        { label: 'Support Hotline', value: '+91 1800-ROADRIDER', type: 'text' },
      ]
    },
    {
      title: 'Database & Backend', items: [
        { label: 'Provider', value: 'Supabase (PostgreSQL)', type: 'text' },
        { label: 'Supabase Status', value: isSupabaseConfigured ? 'Connected (Production)' : 'Not Configured', type: 'text' },
        { label: 'Project URL', value: SUPABASE_URL ? SUPABASE_URL.slice(0, 32) + '...' : 'Not configured', type: 'text' },
        { label: 'Row Level Security', value: 'Enforced (Active Policies)', type: 'text' },
      ]
    },
    {
      title: 'Feature Availability', items: [
        { label: 'Vendor Onboarding Flow', value: 'Enabled', type: 'toggle' },
        { label: 'Delivery Partner Console', value: 'Enabled', type: 'toggle' },
        { label: 'Live Telemetry & Jobs', value: 'Enabled', type: 'toggle' },
        { label: 'Multi-service Dispatch', value: 'Enabled', type: 'toggle' },
      ]
    },
  ];

  return (
    <div className="p-6">
      <SectionHeader title="System & Security" subtitle="Admin identities, RBAC matrix, live audit trail and infrastructure configuration">
        <Btn small onClick={() => { refetchAdmins(); refetchAudit(); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${(loadingAdmins || loadingAudit) ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Admin Users' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="border border-[#E8E8E8] rounded-xl p-4 bg-white">
              <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>VERIFIED ADMIN ACCOUNTS</p>
              <p className="text-xl font-black font-mono-data text-black">{adminUsers.length}</p>
            </div>
            <div className="border border-[#E8E8E8] rounded-xl p-4 bg-white">
              <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>MASTER ADMIN ACCESS</p>
              <p className="text-xl font-black font-mono-data text-emerald-600">Active (techroadrider@gmail.com)</p>
            </div>
            <div className="border border-[#E8E8E8] rounded-xl p-4 bg-white">
              <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>DATABASE SOURCE</p>
              <p className="text-xl font-black font-mono-data text-black">public.profiles</p>
            </div>
          </div>
          <DataTable columns={userColumns} rows={userRows} />
        </>
      )}

      {tab === 'Roles & Permissions' && (
        <div>
          <p className="text-sm text-[#9C9A9A] mb-4">RBAC Permission Matrix for Master Administrator role</p>
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-white">
            <table className="rr-table">
              <thead>
                <tr>
                  <th>MODULE</th>
                  <th className="text-center">VIEW</th>
                  <th className="text-center">CREATE</th>
                  <th className="text-center">EDIT</th>
                  <th className="text-center">APPROVE</th>
                  <th className="text-center">REJECT</th>
                  <th className="text-center">REFUND</th>
                  <th className="text-center">SUSPEND</th>
                  <th className="text-center">CONFIG</th>
                  <th className="text-center">EXPORT</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(p => (
                  <PermRow key={p.module} module={p.module} perms={{
                    view: p.view, create: p.create, edit: p.edit, approve: p.approve,
                    reject: p.reject, refund: p.refund, suspend: p.suspend, configure: p.configure, export: p.export
                  }} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Audit Logs' && (
        <>
          <div className="mb-4">
            <p className="text-xs text-[#9C9A9A]">Immutable audit trail recording administrative and system operations from `public.audit_logs`</p>
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No audit log entries recorded in database.
            </div>
          ) : (
            <DataTable columns={auditColumns} rows={auditRows} />
          )}
        </>
      )}

      {tab === 'System Settings' && (
        <div className="grid grid-cols-2 gap-5">
          {SETTINGS_SECTIONS.map(section => (
            <div key={section.title} className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
              <p className="text-sm font-bold mb-4">{section.title.toUpperCase()}</p>
              <div className="space-y-3">
                {section.items.map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#F0F0F0] last:border-0">
                    <label className="text-sm font-medium text-[#464646]">{item.label}</label>
                    <span className="text-xs font-semibold text-black font-mono-data">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
