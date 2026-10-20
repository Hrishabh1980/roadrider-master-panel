import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, FilterBar, Drawer, DrawerSection, DetailRow, Btn, Tabs, KPICard, AlertBanner } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { riskApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Download, ShieldAlert, Check, X, PhoneCall, AlertTriangle, UserX, RefreshCw } from 'lucide-react';

export default function Risk({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: dbCases, loading, refetch } = useApi(
    () => riskApi.getCases(),
    []
  );

  const [cases, setCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Risk Dashboard');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (dbCases) {
      setCases(dbCases);
    }
  }, [dbCases]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      ['ID,Entity,Type,Severity,Status,Created'].join(',') + '\n' +
      cases.map(c => `${c.id},"${c.entity}","${c.type}",${c.severity},${c.status},${c.created}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'roadrider_risk_incidents.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Risk audit log exported to CSV');
  };

  const handleUpdateStatus = async (caseId: string, status: string) => {
    try {
      const rawId = selected?._raw?.id || caseId;
      await riskApi.updateCase(rawId, status);
      setCases(prev => prev.map(c => (c.id === caseId || c._raw?.id === rawId) ? { ...c, status } : c));
      if (selected) {
        setSelected({ ...selected, status });
      }
      showToast(`Case status updated to ${status}`);
      refetch();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const tabs = ['Risk Dashboard', 'Fraud Cases', 'Safety Incidents'];

  const columns = [
    { key: 'id', label: 'RISK ID', width: '100px' },
    { key: 'entity', label: 'ENTITY' },
    { key: 'type', label: 'RISK TYPE' },
    { key: 'severity', label: 'SEVERITY', width: '100px' },
    { key: 'created', label: 'DETECTED', width: '100px' },
    { key: 'description', label: 'DESCRIPTION' },
    { key: 'status', label: 'STATUS', width: '120px' },
    { key: 'actions', label: '', width: '80px' },
  ];

  const rows = cases.map(r => ({
    ...r,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{r.id}</span>,
    entity: <span className="font-semibold text-black">{r.entity}</span>,
    severity: <Badge variant={r.severity?.toLowerCase() || 'medium'} label={r.severity || 'Medium'} />,
    status: <Badge variant={r.status?.toLowerCase().replace(/\s+/g, '') || 'open'} label={r.status || 'Open'} showDot />,
    actions: (
      <button onClick={e => { e.stopPropagation(); setSelected(r); setDrawerOpen(true); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">Investigate</button>
    ),
    _raw: r,
  }));

  const criticalCount = cases.filter(c => c.severity === 'Critical' || c.severity === 'High').length;
  const openCount = cases.filter(c => c.status !== 'Resolved').length;

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Risk & Safety" subtitle="Fraud detection, safety incidents and account trust">
        <Btn small onClick={() => { refetch(); showToast('Refreshing risk data from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn small variant="primary" onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export Risk Report
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Risk Dashboard' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-5">
            <KPICard label="TOTAL RISK CASES" value={String(cases.length)} />
            <KPICard label="OPEN CASES" value={String(openCount)} highlight={openCount > 0} />
            <KPICard label="CRITICAL / HIGH" value={String(criticalCount)} highlight={criticalCount > 0} />
            <KPICard label="RISK ENGINE" value="Automated Live Guard" />
          </div>

          {cases.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              ✓ Zero risk flags or safety incidents reported in database. All accounts and trips are in good standing.
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
            />
          )}
        </>
      )}

      {(activeTab === 'Fraud Cases' || activeTab === 'Safety Incidents') && (
        <>
          {cases.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No {activeTab.toLowerCase()} recorded in database.
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows.filter(r => {
                if (activeTab === 'Fraud Cases') return r.type?.toLowerCase().includes('fraud') || r.type?.toLowerCase().includes('spoof') || r.type?.toLowerCase().includes('coupon');
                if (activeTab === 'Safety Incidents') return r.type?.toLowerCase().includes('safety') || r.type?.toLowerCase().includes('sos') || r.type?.toLowerCase().includes('route');
                return true;
              })}
              onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
            />
          )}
        </>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.id || 'Risk Incident'}
        subtitle={`${selected?.type} · ${selected?.severity} Severity`}
        badge={selected ? <Badge variant={selected.severity?.toLowerCase() || 'medium'} label={selected.severity || 'Medium'} /> : null}
      >
        {selected && (
          <>
            <DrawerSection title="CASE DETAILS">
              <DetailRow label="Case ID" value={selected.id} mono />
              <DetailRow label="Entity Type" value={selected.entity} />
              <DetailRow label="Risk Type" value={selected.type} />
              <DetailRow label="Severity" value={<Badge variant={selected.severity?.toLowerCase() || 'medium'} label={selected.severity} />} />
              <DetailRow label="Status" value={<Badge variant={selected.status?.toLowerCase().replace(/\s+/g, '') || 'open'} label={selected.status} showDot />} />
              <DetailRow label="Detected" value={selected.created} />
              <DetailRow label="Summary" value={selected.description} />
            </DrawerSection>

            <DrawerSection title="INVESTIGATION ACTIONS">
              <div className="flex flex-col gap-2 pt-2">
                {selected.status !== 'Resolved' && (
                  <button
                    onClick={() => handleUpdateStatus(selected.id, 'Resolved')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    ✓ Mark Case Resolved
                  </button>
                )}
                {selected.status !== 'Under Review' && (
                  <button
                    onClick={() => handleUpdateStatus(selected.id, 'Under Review')}
                    className="w-full py-2.5 border border-[#E8E8E8] hover:bg-[#F5F5F5] text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Set Under Review
                  </button>
                )}
                <button
                  onClick={() => handleUpdateStatus(selected.id, 'Flagged')}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Flag as Critical Risk
                </button>
              </div>
            </DrawerSection>
          </>
        )}
      </Drawer>
    </div>
  );
}
