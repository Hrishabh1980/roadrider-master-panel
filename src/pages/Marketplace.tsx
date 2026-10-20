import React, { useState, useEffect } from 'react';
import { Star, Plus, Edit2, Check, X, Download, Tag, ShoppingBag, Utensils, RefreshCw } from 'lucide-react';
import {
  SectionHeader, DataTable, Badge, FilterBar,
  Drawer, DrawerSection, DetailRow, Btn, KPICard, StatGroup,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { marketplaceApi, vendorsApi } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';

// ─── Restaurants page ─────────────────────────────────────────────────
export function Restaurants({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: apiResponse, loading, refetch } = useApi(
    () => marketplaceApi.getRestaurants(),
    { data: [], total: 0 }
  );

  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Add form
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [category, setCategory] = useState('North Indian');
  const [zone, setZone] = useState('Zone A');

  useEffect(() => {
    if (apiResponse?.data) {
      setRestaurantsList(apiResponse.data);
    }
  }, [apiResponse]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('stores').insert({
          store_name: name.trim(),
          business_type: 'restaurant',
          status: 'OFFLINE',
          is_active: false,
        });

        if (error) {
          showToast(`Error adding restaurant: ${error.message}`);
          return;
        }

        showToast(`Restaurant ${name.trim()} added successfully (offline by default)`);
        setAddModalOpen(false);
        setName('');
        setOwner('');
        refetch();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleToggleSuspend = async (id: string) => {
    const target = restaurantsList.find(r => r.id === id);
    if (!target) return;
    const isCurrentlySuspended = target.status === 'Suspended';
    const next = isCurrentlySuspended ? 'Offline' : 'Suspended';

    setRestaurantsList(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));
    if (selected && selected.id === id) {
      setSelected((prev: any) => ({ ...prev, status: next }));
    }

    if (isSupabaseConfigured && target?._dbId) {
      try {
        if (isCurrentlySuspended) {
          await vendorsApi.unsuspendStore(target._dbId);
          showToast(`✅ Restaurant ${target.name} reactivated (eligible for operation)`);
        } else {
          await vendorsApi.suspendStore(target._dbId);
          showToast(`🚫 Restaurant ${target.name} suspended across all apps`);
        }
        refetch();
      } catch (err: any) {
        console.error('Error updating store status:', err);
        showToast(`❌ Failed to update store status: ${err.message}`);
        refetch();
      }
    }
  };

  const filtered = restaurantsList.filter(r =>
    String(r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.owner || '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'id', label: 'ID', width: '90px' },
    { key: 'name', label: 'RESTAURANT NAME' },
    { key: 'owner', label: 'OWNER' },
    { key: 'city', label: 'CITY', width: '90px' },
    { key: 'zone', label: 'ZONE', width: '90px' },
    { key: 'category', label: 'CUISINE / TYPE' },
    { key: 'orders', label: 'ORDERS', width: '80px' },
    { key: 'revenue', label: 'REVENUE', width: '90px' },
    { key: 'rating', label: 'RATING', width: '70px' },
    { key: 'status', label: 'STATUS', width: '90px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const rows = filtered.map(r => ({
    ...r,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{r.id}</span>,
    name: (
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-black text-xs">{r.name}</span>
        {r.featured && <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1 rounded">PRO</span>}
      </div>
    ),
    rating: <span className="font-bold text-xs">{r.rating !== '—' ? `${r.rating} ★` : '—'}</span>,
    status: <Badge variant={r.status.toLowerCase()} label={r.status} showDot />,
    actions: (
      <button
        onClick={e => {
          e.stopPropagation();
          setSelected(r);
          setDrawerOpen(true);
        }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer"
      >
        Manage
      </button>
    ),
    _raw: r,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Restaurant Directory" subtitle="Manage registered food vendors and kitchens">
        <Btn small onClick={() => { refetch(); showToast('Syncing restaurants from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn variant="primary" small onClick={() => setAddModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Restaurant
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <KPICard label="REGISTERED RESTAURANTS" value={String(restaurantsList.length)} />
        <KPICard label="ACTIVE NOW" value={String(restaurantsList.filter(r => r.status === 'Active').length)} />
        <KPICard label="SUSPENDED" value={String(restaurantsList.filter(r => r.status === 'Suspended').length)} highlight={restaurantsList.some(r => r.status === 'Suspended')} />
        <KPICard label="DIRECTORY STATUS" value="Production Storefront" />
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search restaurants by name, owner, or cuisine…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
        />
      </div>

      {restaurantsList.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No restaurant vendors currently registered in database. Approved vendors with restaurant stores appear here.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
        />
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.name || ''}
        subtitle={`${selected?.id} · ${selected?.category} · ${selected?.city}`}
        badge={selected ? <Badge variant={selected.status.toLowerCase()} label={selected.status} showDot /> : null}
      >
        {selected && (
          <>
            <DrawerSection title="RESTAURANT PROFILE">
              <DetailRow label="Store ID" value={selected.id} mono />
              <DetailRow label="Name" value={selected.name} />
              <DetailRow label="Owner" value={selected.owner} />
              <DetailRow label="City & Zone" value={`${selected.city} (${selected.zone})`} />
              <DetailRow label="Cuisine / Category" value={selected.category} />
              <DetailRow label="Status" value={<Badge variant={selected.status.toLowerCase()} label={selected.status} showDot />} />
            </DrawerSection>

            <DrawerSection title="OPERATIONAL ACTIONS">
              <div className="pt-2">
                <button
                  onClick={() => handleToggleSuspend(selected.id)}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl text-white transition-colors cursor-pointer ${
                    selected.status === 'Suspended'
                      ? 'bg-black hover:bg-[#333]'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {selected.status === 'Suspended' ? 'Reactivate Store' : 'Suspend Store'}
                </button>
                <p className="text-[10px] text-[#9C9A9A] mt-2 text-center">
                  {selected.status === 'Suspended'
                    ? 'Reactivating restores the store to Offline eligible state. Vendor must manually toggle Online.'
                    : 'Suspending immediately halts customer order acceptance and prevents store from going Online.'}
                </p>
              </div>
            </DrawerSection>
          </>
        )}
      </Drawer>

      {/* Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Register Restaurant</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Restaurant Name *</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Baba Dhaba"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Owner Name</label>
                <input
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  placeholder="e.g. Ramesh Gupta"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Register Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Grocery Stores page ──────────────────────────────────────────────
export function GroceryStores({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: apiResponse, loading, refetch } = useApi(
    () => marketplaceApi.getGroceryStores(),
    { data: [], total: 0 }
  );

  const [groceryList, setGroceryList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [owner, setOwner] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (apiResponse?.data) {
      setGroceryList(apiResponse.data);
    }
  }, [apiResponse]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('stores').insert({
          store_name: storeName.trim(),
          business_type: 'grocery',
          status: 'OFFLINE',
          is_active: false,
        });

        if (error) {
          showToast(`Error adding store: ${error.message}`);
          return;
        }

        showToast(`Grocery Store ${storeName.trim()} registered`);
        setAddModalOpen(false);
        setStoreName('');
        setOwner('');
        refetch();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const handleToggleSuspend = async (id: string) => {
    const target = groceryList.find(g => g.id === id);
    if (!target) return;
    const isCurrentlySuspended = target.status === 'Suspended';
    const next = isCurrentlySuspended ? 'Offline' : 'Suspended';

    setGroceryList(prev => prev.map(g => g.id === id ? { ...g, status: next } : g));
    if (selected && selected.id === id) {
      setSelected((prev: any) => ({ ...prev, status: next }));
    }

    if (isSupabaseConfigured && target?._dbId) {
      try {
        if (isCurrentlySuspended) {
          await vendorsApi.unsuspendStore(target._dbId);
          showToast(`✅ Grocery store ${target.name} reactivated (eligible for operation)`);
        } else {
          await vendorsApi.suspendStore(target._dbId);
          showToast(`🚫 Grocery store ${target.name} suspended across all apps`);
        }
        refetch();
      } catch (err: any) {
        console.error('Error updating grocery store status:', err);
        showToast(`❌ Failed to update store status: ${err.message}`);
        refetch();
      }
    }
  };

  const columns = [
    { key: 'id', label: 'ID', width: '90px' },
    { key: 'name', label: 'STORE NAME' },
    { key: 'owner', label: 'OWNER' },
    { key: 'city', label: 'CITY', width: '90px' },
    { key: 'zone', label: 'ZONE', width: '90px' },
    { key: 'orders', label: 'ORDERS', width: '80px' },
    { key: 'revenue', label: 'REVENUE', width: '90px' },
    { key: 'status', label: 'STATUS', width: '90px' },
    { key: 'actions', label: '', width: '70px' },
  ];

  const rows = groceryList.map(g => ({
    ...g,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{g.id}</span>,
    name: <span className="font-semibold text-black text-xs">{g.name}</span>,
    status: <Badge variant={g.status.toLowerCase()} label={g.status} showDot />,
    actions: (
      <button
        onClick={e => {
          e.stopPropagation();
          setSelected(g);
          setDrawerOpen(true);
        }}
        className="text-xs font-semibold text-[#A35E47] hover:underline cursor-pointer"
      >
        Manage
      </button>
    ),
    _raw: g,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Grocery Directory" subtitle="Manage grocery retailers, supermarkets, and dark stores">
        <Btn small onClick={() => { refetch(); showToast('Syncing grocery stores from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn variant="primary" small onClick={() => setAddModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Grocery Store
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <KPICard label="TOTAL GROCERY STORES" value={String(groceryList.length)} />
        <KPICard label="ACTIVE NOW" value={String(groceryList.filter(g => g.status === 'Active').length)} />
        <KPICard label="SUSPENDED" value={String(groceryList.filter(g => g.status === 'Suspended').length)} highlight={groceryList.some(g => g.status === 'Suspended')} />
        <KPICard label="DIRECTORY STATUS" value="Grocery Storefront" />
      </div>

      {groceryList.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No grocery stores currently registered in database. Approved grocery vendors appear here.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={row => { setSelected((row as any)._raw); setDrawerOpen(true); }}
        />
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!selected}
        onClose={() => setDrawerOpen(false)}
        title={selected?.name || ''}
        subtitle={`${selected?.id} · Grocery Store · ${selected?.city}`}
        badge={selected ? <Badge variant={selected.status.toLowerCase()} label={selected.status} showDot /> : null}
      >
        {selected && (
          <>
            <DrawerSection title="STORE PROFILE">
              <DetailRow label="Store ID" value={selected.id} mono />
              <DetailRow label="Name" value={selected.name} />
              <DetailRow label="Owner" value={selected.owner} />
              <DetailRow label="City & Zone" value={`${selected.city} (${selected.zone})`} />
              <DetailRow label="Status" value={<Badge variant={selected.status.toLowerCase()} label={selected.status} showDot />} />
            </DrawerSection>

            <DrawerSection title="OPERATIONAL ACTIONS">
              <div className="pt-2">
                <button
                  onClick={() => handleToggleSuspend(selected.id)}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl text-white transition-colors cursor-pointer ${
                    selected.status === 'Suspended'
                      ? 'bg-black hover:bg-[#333]'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {selected.status === 'Suspended' ? 'Reactivate Store' : 'Suspend Store'}
                </button>
                <p className="text-[10px] text-[#9C9A9A] mt-2 text-center">
                  {selected.status === 'Suspended'
                    ? 'Reactivating restores the store to Offline eligible state. Vendor must manually toggle Online.'
                    : 'Suspending immediately halts customer order acceptance and prevents store from going Online.'}
                </p>
              </div>
            </DrawerSection>
          </>
        )}
      </Drawer>

      {/* Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Register Grocery Store</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleAddStore} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Store Name *</label>
                <input
                  required
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="e.g. FreshMart Grocery"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Owner Name</label>
                <input
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  placeholder="e.g. Sanjay Agarwal"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Register Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Products / Menu page ─────────────────────────────────────────────
export function Products({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: apiResponse, loading, refetch } = useApi(
    () => marketplaceApi.getProducts(),
    { data: [], total: 0 }
  );

  const [productList, setProductList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (apiResponse?.data) {
      setProductList(apiResponse.data);
    }
  }, [apiResponse]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const columns = [
    { key: 'id', label: 'PRODUCT ID', width: '100px' },
    { key: 'name', label: 'PRODUCT NAME' },
    { key: 'category', label: 'CATEGORY' },
    { key: 'price', label: 'PRICE', width: '90px' },
    { key: 'status', label: 'STATUS', width: '90px' },
  ];

  const rows = productList.map(p => ({
    ...p,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{p.id}</span>,
    name: <span className="font-semibold text-xs text-black">{p.name}</span>,
    price: <span className="font-bold font-mono-data text-xs">{p.price}</span>,
    status: <Badge variant={p.status?.toLowerCase() || 'active'} label={p.status || 'Active'} showDot />,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Product & Menu Catalog" subtitle="Catalog items and dish offerings across active stores">
        <Btn small onClick={() => { refetch(); showToast('Syncing products from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KPICard label="CATALOG PRODUCTS" value={String(productList.length)} />
        <KPICard label="ACTIVE ITEMS" value={String(productList.filter(p => p.status === 'Active').length)} />
        <KPICard label="CATALOG ENGINE" value="Multi-Vendor Catalog" />
      </div>

      {productList.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No products currently cataloged in database. Vendors add products from their respective store dashboards.
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </div>
  );
}

// ─── Categories page ──────────────────────────────────────────────────
export function Categories({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data: dbCategories, loading, refetch } = useApi(
    () => marketplaceApi.getCategories(),
    []
  );

  const [catList, setCatList] = useState<any[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catService, setCatService] = useState('Food');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (dbCategories) {
      setCatList(dbCategories);
    }
  }, [dbCategories]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('product_categories').insert({
          name: catName.trim(),
          business_type: catService.toLowerCase(),
          is_active: true,
        });

        if (error) {
          showToast(`Error creating category: ${error.message}`);
          return;
        }

        showToast(`Category ${catName.trim()} created!`);
        setAddModalOpen(false);
        setCatName('');
        refetch();
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    }
  };

  const columns = [
    { key: 'id', label: 'CATEGORY ID', width: '100px' },
    { key: 'name', label: 'CATEGORY NAME' },
    { key: 'service', label: 'SERVICE TYPE' },
    { key: 'status', label: 'STATUS', width: '90px' },
  ];

  const rows = catList.map(c => ({
    ...c,
    id: <span className="text-xs font-mono-data font-bold text-[#9C9A9A]">{c.id}</span>,
    name: <span className="font-semibold text-xs text-black">{c.icon || '📦'} {c.name}</span>,
    status: <Badge variant={c.status?.toLowerCase() || 'active'} label={c.status || 'Active'} showDot />,
  }));

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-once">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      <SectionHeader title="Category Taxonomy" subtitle="Global category hierarchy across Food, Grocery and Retail">
        <Btn small onClick={() => { refetch(); showToast('Syncing categories from Supabase...'); }}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
        <Btn variant="primary" small onClick={() => setAddModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
        </Btn>
      </SectionHeader>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KPICard label="TOTAL CATEGORIES" value={String(catList.length)} />
        <KPICard label="ACTIVE CATEGORIES" value={String(catList.filter(c => c.status === 'Active').length)} />
        <KPICard label="TAXONOMY STATUS" value="Active Schema" />
      </div>

      {catList.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9C9A9A] bg-white rounded-xl border border-[#E8E8E8]">
          No product categories registered in database. Click <strong>+ Add Category</strong> to create taxonomy nodes.
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}

      {/* Add Category Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-black">Create Category</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-lg hover:bg-[#F5F5F5]">
                <X className="w-4 h-4 text-[#9C9A9A]" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Category Name *</label>
                <input
                  required
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="e.g. Biryani or Dairy"
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464646] mb-1">Service</label>
                <select
                  value={catService}
                  onChange={e => setCatService(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E8E8E8] rounded-xl outline-none bg-white"
                >
                  <option value="Food">Food Delivery</option>
                  <option value="Grocery">Grocery Delivery</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#E8E8E8] text-xs font-semibold rounded-xl hover:bg-[#F5F5F5]">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333]">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
