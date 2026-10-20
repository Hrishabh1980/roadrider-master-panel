import React, { useState, useEffect } from 'react';
import {
  Zap, Search, RefreshCw, X, Check, Navigation
} from 'lucide-react';
import { SectionHeader, DataTable, Badge, ServiceBadge, Drawer, DrawerSection, DetailRow, Btn, KPICard, LiveDot } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { dashboardApi, partnersApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useBadges } from '../context/BadgeContext';

export default function LiveJobs({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { refreshBadges } = useBadges();
  const { data: liveJobsData, loading, refetch } = useApi(
    () => dashboardApi.getLiveJobs(),
    []
  );

  const { data: partnersData } = useApi(
    () => partnersApi.getAll({ status: 'online' }),
    { data: [], total: 0 }
  );

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [reassignModal, setReassignModal] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (liveJobsData) {
      setJobs(liveJobsData);
    }
  }, [liveJobsData]);

  const availableDrivers = partnersData?.data || [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReassign = async () => {
    if (!reassignModal || !selectedDriverId) return;
    const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);
    const driverName = selectedDriver ? selectedDriver.name : 'Assigned Partner';

    try {
      if (isSupabaseConfigured && reassignModal._raw?.id) {
        await supabase
          .from('orders')
          .update({
            partner_id: selectedDriver?._raw?.id || selectedDriverId,
            order_status: 'in_transit'
          })
          .eq('id', reassignModal._raw.id);
      }
      setJobs(prev => prev.map(j => j.id === reassignModal.id ? { ...j, partner: driverName, status: 'In Transit', flag: null } : j));
      showToast(`Driver reassigned to ${driverName} for ${reassignModal.id}`);
      setReassignModal(null);
      if (selectedJob?.id === reassignModal.id) {
        setSelectedJob((prev: any) => ({ ...prev, partner: driverName, status: 'In Transit', flag: null }));
      }
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error assigning driver: ${err.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      if (isSupabaseConfigured && selectedJob?._raw?.id) {
        await supabase.from('orders').update({ order_status: 'cancelled' }).eq('id', selectedJob._raw.id);
      }
      setJobs(prev => prev.filter(j => j.id !== jobId && j._raw?.id !== selectedJob?._raw?.id));
      showToast(`Job ${jobId} cancelled`);
      setDrawerOpen(false);
      refetch();
      refreshBadges();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleEscalate = (jobId: string) => {
    showToast(`Job ${jobId} escalated to Trust & Safety priority queue`);
    if (onNavigate) onNavigate('risk');
  };

  const filtered = jobs.filter(j => {
    if (serviceFilter !== 'All' && j.service !== serviceFilter) return false;
    if (statusFilter !== 'All' && j.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        String(j.id || '').toLowerCase().includes(q) ||
        String(j.customer || '').toLowerCase().includes(q) ||
        String(j.partner || '').toLowerCase().includes(q) ||
        String(j.pickup || '').toLowerCase().includes(q) ||
        String(j.dest || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns = [
    { key: 'id', label: 'JOB ID', width: '110px' },
    { key: 'service', label: 'SERVICE', width: '100px' },
    { key: 'customer', label: 'CUSTOMER' },
    { key: 'partner', label: 'ASSIGNED PARTNER' },
    { key: 'route', label: 'ROUTE (PICKUP → DESTINATION)' },
    { key: 'eta', label: 'ETA', width: '90px' },
    { key: 'status', label: 'STATUS', width: '120px' },
    { key: 'actions', label: '', width: '140px' },
  ];

  const rows = filtered.map(job => ({
    ...job,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{job.id}</span>,
    service: <ServiceBadge service={job.service} />,
    customer: <span className="font-semibold text-xs text-black">{job.customer}</span>,
    partner: (
      <span className={`text-xs ${job.partner === '—' ? 'text-[#A35E47] font-bold' : 'text-[#464646] font-medium'}`}>
        {job.partner === '—' ? '⚠️ Unassigned' : job.partner}
      </span>
    ),
    route: (
      <div className="text-xs truncate max-w-md">
        <span className="font-semibold text-black">{job.pickup}</span>
        <span className="text-[#9C9A9A] mx-1.5">→</span>
        <span className="text-[#464646]">{job.dest}</span>
      </div>
    ),
    eta: <span className="text-xs font-bold font-mono-data">{job.eta || '—'}</span>,
    status: (
      <div className="flex flex-col gap-0.5">
        <Badge variant={job.status?.toLowerCase().replace(/\s+/g, '') || 'pending'} label={job.status || 'Active'} showDot />
        {job.flag && <span className="text-[10px] font-bold text-[#A35E47]">{job.flag}</span>}
      </div>
    ),
    actions: (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedJob(job); setDrawerOpen(true); }}
          className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer"
        >
          Details
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setReassignModal(job); }}
          className="text-xs font-semibold text-black hover:underline cursor-pointer"
        >
          Assign
        </button>
      </div>
    ),
    _raw: job,
  }));

  const activeJobsCount = jobs.filter(j => j.status !== 'Cancelled' && j.status !== 'Completed' && j.status !== 'Delivered').length;
  const inTransitCount = jobs.filter(j => (j.status === 'In Transit' || j.status === 'In Progress' || j.status === 'Picked Up')).length;
  const searchingCount = jobs.filter(j => (j.status === 'Searching' || j.partner === '—' || j.partner === 'Unassigned') && j.status !== 'Cancelled' && j.status !== 'Completed' && j.status !== 'Delivered').length;
  const flaggedCount = jobs.filter(j => j.flag !== null && j.flag !== undefined).length;

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Live Operations & Active Jobs" subtitle="Real-time live monitoring of all orders, rides and delivery jobs">
        <LiveDot />
        <Btn small onClick={() => { refetch(); showToast('Refreshing live jobs feed from Supabase...'); }}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn small variant="primary" onClick={() => onNavigate && onNavigate('dispatch')}>
          <Navigation className="w-3 h-3 mr-1" /> Open Dispatch Console
        </Btn>
      </SectionHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KPICard label="ACTIVE JOBS NOW" value={String(activeJobsCount)} />
        <KPICard label="IN TRANSIT" value={String(inTransitCount)} />
        <KPICard label="SEARCHING / UNASSIGNED" value={String(searchingCount)} highlight={searchingCount > 0} />
        <KPICard label="DELAYED / FLAGS" value={String(flaggedCount)} highlight={flaggedCount > 0} />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9C9A9A]" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search active jobs, partners, locations…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E8E8E8] bg-white outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-[#E8E8E8] bg-white text-black outline-none cursor-pointer"
          >
            <option value="All">All Services</option>
            <option value="Food">Food</option>
            <option value="Grocery">Grocery</option>
            <option value="Rides">Rides</option>
            <option value="Courier">Courier</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-[#E8E8E8] bg-white text-black outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="In Transit">In Transit</option>
            <option value="In Progress">In Progress</option>
            <option value="Searching">Searching</option>
            <option value="Delayed">Delayed</option>
            <option value="Picked Up">Picked Up</option>
          </select>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No active delivery jobs currently recorded.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={row => { setSelectedJob((row as any)._raw); setDrawerOpen(true); }}
        />
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!selectedJob}
        onClose={() => setDrawerOpen(false)}
        title={selectedJob?.id || 'Job Details'}
        subtitle={`Live Job Details · ${selectedJob?.service || 'Delivery'}`}
        badge={selectedJob ? <Badge variant={selectedJob.status?.toLowerCase().replace(/\s+/g, '') || 'pending'} label={selectedJob.status || 'Pending'} showDot /> : null}
      >
        {selectedJob && (
          <>
            <DrawerSection title="JOB SPECIFICATION">
              <DetailRow label="Job ID" value={selectedJob.id} mono />
              <DetailRow label="Service Type" value={<ServiceBadge service={selectedJob.service} />} />
              <DetailRow label="Customer" value={selectedJob.customer || '—'} />
              <DetailRow label="Assigned Partner" value={selectedJob.partner && selectedJob.partner !== '—' ? selectedJob.partner : 'Unassigned'} />
              <DetailRow label="Pickup Point" value={selectedJob.pickup || '—'} />
              <DetailRow label="Destination" value={selectedJob.dest || '—'} />
              <DetailRow label="Estimated Time" value={selectedJob.eta || '—'} />
              <DetailRow label="Status" value={selectedJob.status || 'Pending'} />
              {selectedJob.flag && <DetailRow label="Active Flag" value={<span className="text-[#A35E47] font-bold">{selectedJob.flag}</span>} />}
            </DrawerSection>

            <DrawerSection title="DISPATCH ACTIONS">
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => setReassignModal(selectedJob)}
                  className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] transition-colors cursor-pointer"
                >
                  Manual Reassign Driver
                </button>
                <button
                  onClick={() => handleEscalate(selectedJob.id)}
                  className="w-full py-2.5 bg-[#A35E47] text-white text-xs font-bold rounded-xl hover:bg-[#8E513D] transition-colors cursor-pointer"
                >
                  Escalate to Risk & Safety
                </button>
                <button
                  onClick={() => handleCancelJob(selectedJob.id)}
                  className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel Active Job
                </button>
              </div>
            </DrawerSection>
          </>
        )}
      </Drawer>

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Assign Partner to Job {reassignModal.id}</h3>
              <button onClick={() => setReassignModal(null)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>
            <p className="text-xs text-[#9C9A9A] mb-4">
              Select an available partner to dispatch to this job:
            </p>

            {availableDrivers.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9C9A9A] bg-[#FAFAFA] rounded-xl border border-[#E8E8E8] mb-5">
                No active online partners found. Onboard or activate a partner in the Partners console.
              </div>
            ) : (
              <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
                {availableDrivers.map((driver: any) => (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedDriverId === driver.id ? 'border-black bg-[#FAFAFA]' : 'border-[#E8E8E8] hover:border-[#CCCCCC]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black">{driver.name}</span>
                      <span className="text-xs font-bold text-emerald-600">{driver.status || 'Online'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#9C9A9A] mt-1">
                      <span>{driver.vehicle || 'Vehicle'}</span>
                      <span>·</span>
                      <span>★ {driver.rating || '5.0'}</span>
                      <span>·</span>
                      <span>{driver.phone || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setReassignModal(null)}
                className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]"
              >
                Cancel
              </button>
              <button
                disabled={!selectedDriverId}
                onClick={handleReassign}
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl ${selectedDriverId ? 'bg-black hover:bg-[#333]' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
