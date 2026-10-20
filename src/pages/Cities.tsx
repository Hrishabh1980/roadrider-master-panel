import React, { useState, useEffect } from 'react';
import { SectionHeader, DataTable, Badge, ServiceBadge, Btn, Tabs, KPICard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { citiesApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Plus, Check, X, Edit, Sliders, MapPin, Globe, RefreshCw } from 'lucide-react';

export default function Cities({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [tab, setTab] = useState('Cities');
  const [selectedCity, setSelectedCity] = useState<any | null>(null);
  const [zoneData, setZoneData] = useState<any[]>([]);
  const [addZoneOpen, setAddZoneOpen] = useState(false);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [editZone, setEditZone] = useState<any | null>(null);
  const [configService, setConfigService] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form states for new zone
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneMultiplier, setNewZoneMultiplier] = useState('1.0x');
  const [newZoneDemand, setNewZoneDemand] = useState('Medium');

  // Form states for new city
  const [newCityName, setNewCityName] = useState('');
  const [newCityState, setNewCityState] = useState('Uttar Pradesh');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = ['Cities', 'Zones', 'Service Availability'];

  const { data: citiesData, loading: loadingCities, refetch: refetchCities } = useApi(
    () => citiesApi.getAll(),
    []
  );

  const { data: liveZones, loading: loadingZones, refetch: refetchZones } = useApi(
    () => citiesApi.getZones(),
    []
  );

  const cities = citiesData || [];

  useEffect(() => {
    if (liveZones) {
      setZoneData(liveZones);
    }
  }, [liveZones]);

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const lucknowCity = cities.find((c: any) => c.name?.toLowerCase().includes('lucknow')) || cities[0];
        const lucknowCityId = lucknowCity?._dbId || 'c223cb6c-74f6-41d3-833e-a8c8ad985e93';
        const { error } = await supabase.from('zones').insert({
          name: newZoneName.trim(),
          city_id: lucknowCityId,
          is_active: true,
          food_enabled: true,
          grocery_enabled: true,
          rides_enabled: true,
          courier_enabled: true,
        });

        if (error) {
          showToast(`Error creating zone: ${error.message}`);
          return;
        }

        showToast(`Zone "${newZoneName.trim()}" created successfully in Lucknow operational hub`);
        setAddZoneOpen(false);
        setNewZoneName('');
        refetchZones();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('cities').insert({
          name: newCityName.trim(),
          state: newCityState.trim(),
          status: 'inactive',
          food_enabled: false,
          grocery_enabled: false,
          rides_enabled: false,
          courier_enabled: false,
        });

        if (error) {
          showToast(`Error adding city: ${error.message}`);
          return;
        }

        showToast(`City "${newCityName.trim()}" registered as expansion target`);
        setAddCityOpen(false);
        setNewCityName('');
        refetchCities();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleSaveEditZone = async () => {
    if (!editZone) return;
    if (isSupabaseConfigured && editZone._dbId) {
      try {
        await supabase.from('zones').update({
          name: editZone.name,
          is_active: editZone.status === 'Active',
        }).eq('id', editZone._dbId);
        refetchZones();
      } catch (err: any) {
        console.error('Error updating zone:', err);
      }
    }
    setZoneData(prev => prev.map(z => z.id === editZone.id ? editZone : z));
    setEditZone(null);
    showToast(`Zone "${editZone.name}" updated successfully`);
  };

  const cityColumns = [
    { key: 'id', label: 'ID', width: '90px' },
    { key: 'name', label: 'CITY' },
    { key: 'status', label: 'STATUS', width: '120px' },
    { key: 'services', label: 'SERVICES' },
    { key: 'vendors', label: 'VENDORS', width: '80px' },
    { key: 'partners', label: 'PARTNERS', width: '90px' },
    { key: 'orders', label: "ORDERS", width: '80px' },
    { key: 'zones', label: 'ZONES', width: '70px' },
    { key: 'actions', label: '', width: '80px' },
  ];

  const cityRows = cities.map((c: any) => ({
    ...c,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{c.id}</span>,
    name: <span className="font-bold">{c.name}</span>,
    status: <Badge variant={c.status === 'Coming Soon' ? 'comingsoon' : 'active'} label={c.status} showDot />,
    services: (
      <div className="flex gap-1 flex-wrap">
        {(c.services || []).map((s: string) => <ServiceBadge key={s} service={s} />)}
      </div>
    ),
    vendors: <span className="font-bold font-mono-data">{c.vendors || 0}</span>,
    partners: <span className="font-bold font-mono-data">{c.partners || 0}</span>,
    orders: <span className="font-bold font-mono-data">{c.orders || 0}</span>,
    zones: <span className="font-bold font-mono-data">{c.name?.toLowerCase().includes('lucknow') ? zoneData.length : (c.zones || 0)}</span>,
    actions: (
      <button onClick={(e) => { e.stopPropagation(); setSelectedCity(c); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">Manage</button>
    ),
    _raw: c,
  }));

  const zoneColumns = [
    { key: 'id', label: 'ZONE ID', width: '100px' },
    { key: 'name', label: 'ZONE NAME' },
    { key: 'city', label: 'CITY', width: '100px' },
    { key: 'services', label: 'SERVICES' },
    { key: 'status', label: 'STATUS', width: '90px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const zoneRows = zoneData.map(z => ({
    ...z,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{z.id}</span>,
    name: <span className="font-semibold">{z.name}</span>,
    services: (
      <div className="flex gap-1 flex-wrap">
        {(z.services || []).map((s: string) => <ServiceBadge key={s} service={s} />)}
      </div>
    ),
    status: <Badge variant={z.status === 'Active' ? 'active' : 'inactive'} label={z.status || 'Active'} showDot />,
    actions: (
      <button onClick={(e) => { e.stopPropagation(); setEditZone(z); }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer">
        Edit
      </button>
    ),
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Cities & Zones" subtitle="Geographic coverage, zone management and service availability">
        <Btn small onClick={() => { refetchCities(); refetchZones(); showToast('Syncing cities and zones from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingCities ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn small onClick={() => setAddZoneOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Zone
        </Btn>
        <Btn variant="primary" small onClick={() => setAddCityOpen(true)}>
          <Globe className="w-3.5 h-3.5 mr-1" /> Plan Expansion City
        </Btn>
      </SectionHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'Cities' && (
        <>
          {selectedCity && (
            <div className="border border-[#E8E8E8] rounded-xl p-5 mb-5 bg-[#FAFAFA] animate-fadeIn">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black">{selectedCity.name}</h3>
                  <p className="text-sm text-[#9C9A9A]">City Management & Service Switches</p>
                </div>
                <button onClick={() => setSelectedCity(null)}
                  className="text-xs font-semibold text-[#9C9A9A] hover:text-black cursor-pointer">✕ Close</button>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {['Food', 'Grocery', 'Rides', 'Courier'].map(s => {
                  const enabled = (selectedCity.services || []).includes(s);
                  return (
                    <div key={s} className={`border rounded-xl p-4 ${enabled ? 'border-black bg-white' : 'border-[#E8E8E8] bg-[#F5F5F5]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <ServiceBadge service={s} />
                        <button
                          onClick={async () => {
                            if (!enabled && !selectedCity.name?.toLowerCase().includes('lucknow')) {
                              showToast('Operational Policy: Active dispatch services are currently restricted exclusively to Lucknow.');
                              return;
                            }
                            const newServices = enabled
                              ? selectedCity.services.filter((x: string) => x !== s)
                              : [...(selectedCity.services || []), s];
                            setSelectedCity({ ...selectedCity, services: newServices });

                            if (isSupabaseConfigured && selectedCity._dbId) {
                              const fieldMap: Record<string, string> = {
                                Food: 'food_enabled',
                                Grocery: 'grocery_enabled',
                                Rides: 'rides_enabled',
                                Courier: 'courier_enabled'
                              };
                              await supabase.from('cities').update({ [fieldMap[s]]: !enabled }).eq('id', selectedCity._dbId);
                              refetchCities();
                            }
                            showToast(`${s} service ${enabled ? 'disabled' : 'enabled'} for ${selectedCity.name}`);
                          }}
                          className={`w-8 h-4 rounded-full cursor-pointer transition-colors ${enabled ? 'bg-black' : 'bg-[#D0D0D0]'}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white mt-0.5 transition-all ${enabled ? 'ml-4' : 'ml-0.5'}`} />
                        </button>
                      </div>
                      <p className="text-xs font-semibold">{enabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Btn small variant="primary" onClick={() => { setSelectedCity(null); showToast('City configuration saved successfully'); }}>
                  Done
                </Btn>
                <Btn small onClick={() => setTab('Zones')}>
                  Manage Zones ({zoneData.length})
                </Btn>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-5">
            <KPICard label="ACTIVE CITIES" value={String(cities.filter(c => c.status === 'Active').length)} />
            <KPICard label="COMING SOON" value={String(cities.filter(c => c.status === 'Coming Soon').length)} />
            <KPICard label="RECORDED ZONES" value={String(zoneData.length)} />
            <KPICard label="PRIMARY HUB" value="Lucknow (Active)" />
          </div>

          {cities.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No cities registered in database.
            </div>
          ) : (
            <DataTable
              columns={cityColumns}
              rows={cityRows}
              onRowClick={row => setSelectedCity((row as any)._raw)}
            />
          )}
        </>
      )}

      {tab === 'Zones' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#9C9A9A]">Operational zones in database ({zoneData.length} zones recorded)</p>
            <Btn small variant="primary" onClick={() => setAddZoneOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Zone
            </Btn>
          </div>

          {zoneData.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
              No operational zones registered in database.
            </div>
          ) : (
            <DataTable columns={zoneColumns} rows={zoneRows} />
          )}

          <div className="mt-6 border border-[#E8E8E8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E8E8E8] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">OPERATIONAL GEOFENCE ZONES</p>
                <p className="text-xs text-[#9C9A9A]">Lucknow municipal zones mapped to Supabase database</p>
              </div>
            </div>
            <div className="h-48 flex items-center justify-center bg-[#FAFAFA]">
              <div className="bg-white border border-[#E8E8E8] rounded-xl px-6 py-4 text-center shadow-sm">
                <MapPin className="w-6 h-6 text-[#A35E47] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#464646]">{zoneData.length} Live Operational Zones</p>
                <p className="text-xs text-[#9C9A9A] mt-1">Configured in Supabase `zones` table</p>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'Service Availability' && (
        <div>
          <p className="text-sm text-[#9C9A9A] mb-4">Configure service availability across registered cities</p>
          <div className="border border-[#E8E8E8] rounded-xl overflow-hidden bg-white">
            <table className="rr-table">
              <thead>
                <tr>
                  <th>CITY</th>
                  <th className="text-center">FOOD</th>
                  <th className="text-center">GROCERY</th>
                  <th className="text-center">RIDES</th>
                  <th className="text-center">COURIER</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((city: any) => (
                  <tr key={city.id}>
                    <td className="font-semibold">{city.name}</td>
                    {['Food', 'Grocery', 'Rides', 'Courier'].map(s => (
                      <td key={s} className="text-center">
                        <div className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold
                          ${(city.services || []).includes(s) ? 'bg-black text-white' : 'bg-[#F0F0F0] text-[#9C9A9A]'}`}>
                          {(city.services || []).includes(s) ? '✓' : '—'}
                        </div>
                      </td>
                    ))}
                    <td>
                      <Badge variant={city.status === 'Coming Soon' ? 'comingsoon' : 'active'} label={city.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Zone Modal */}
      {addZoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Add New Operational Zone</h3>
              <button onClick={() => setAddZoneOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Operational City (Hub)</label>
                <div className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl bg-[#F8F8F8] text-[#464646] font-semibold flex items-center justify-between">
                  <span>Lucknow (Uttar Pradesh)</span>
                  <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Active Service Hub</span>
                </div>
                <p className="text-[10px] text-[#9C9A9A] mt-1">Operational dispatch zones are currently restricted to Lucknow.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Zone Area / Name *</label>
                <input
                  required
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  placeholder="e.g. Mahanagar or Chowk"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none focus:border-black"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddZoneOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Save Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add City Modal */}
      {addCityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Add Expansion City</h3>
              <button onClick={() => setAddCityOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleAddCity} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">City Name *</label>
                <input
                  required
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                  placeholder="e.g. Kanpur, Varanasi"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">State</label>
                <input
                  value={newCityState}
                  onChange={e => setNewCityState(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none focus:border-black"
                />
              </div>

              <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3 text-[11px] text-[#464646] space-y-1">
                <p className="font-bold text-black">Operational Policy Notice</p>
                <p className="text-[#9C9A9A]">New cities are added as planning targets with status &quot;Coming Soon&quot;. Active live dispatch operations remain strictly restricted to Lucknow.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddCityOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Add City
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Zone Modal */}
      {editZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Edit Zone: {editZone.name}</h3>
              <button onClick={() => setEditZone(null)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Zone Name</label>
                <input
                  value={editZone.name}
                  onChange={e => setEditZone({ ...editZone, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Status</label>
                <select
                  value={editZone.status}
                  onChange={e => setEditZone({ ...editZone, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditZone(null)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button onClick={handleSaveEditZone}
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
