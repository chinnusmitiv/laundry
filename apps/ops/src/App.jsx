import React, { useEffect, useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  api, fmt, useSocket, getSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_FLOW, GARMENT_LABEL,
  Logo, Button, Chip, Avatar, StatusPill, Empty, OneMap, GarmentJourney, FleetMap, PlacesAutocomplete, printInvoice, distKm,
  downloadCsv, parseCsv,
} from '@shared';

const qs = (facilityId) => (facilityId ? `?facility_id=${facilityId}` : '');

export default function App() {
  const [scope, setScope] = useState(() => { try { return JSON.parse(localStorage.getItem('cl_ops_scope')); } catch { return null; } });
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const facilityId = scope?.facilityId || null;
  const isHQ = !!scope?.isHQ;

  const refreshStats = useCallback(() => { if (scope) api.get('/api/ops/stats' + qs(facilityId)).then(setStats); }, [scope, facilityId]);
  useEffect(() => { refreshStats(); }, [refreshStats]);
  useSocket({ 'order:updated': refreshStats, 'order:new': refreshStats, 'driver:shift': refreshStats }, { role: 'ops' }, [scope]);

  const pick = (sc) => { localStorage.setItem('cl_ops_scope', JSON.stringify(sc)); setScope(sc); setView('dashboard'); };
  const switchConsole = () => { localStorage.removeItem('cl_ops_scope'); setScope(null); };

  if (!scope) return <ConsolePicker onPick={pick} />;

  // HQ sees everything; a warehouse console sees only its own ops
  const nav = isHQ
    ? [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' },
      { key: 'orders', label: 'Orders & routing', icon: '📦' },
      { key: 'customers', label: 'Customers', icon: '👥' },
      { key: 'warehouses', label: 'Warehouses', icon: '🏭' },
      { key: 'facility', label: 'Facility', icon: '🏬' },
      { key: 'drivers', label: 'Drivers', icon: '🚚' },
      { key: 'tags', label: 'Tag station', icon: '🏷️' },
      { key: 'support', label: 'Support', icon: '💬', badge: stats?.open_threads },
      { key: 'invoicing', label: 'Invoicing & Payouts', icon: '🧾' },
      { key: 'settings', label: 'Settings', icon: '⚙️' },
    ]
    : [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' },
      { key: 'orders', label: 'My orders', icon: '📦' },
      { key: 'facility', label: 'Facility', icon: '🏭' },
      { key: 'tags', label: 'Tag station', icon: '🏷️' },
      { key: 'support', label: 'Support', icon: '💬' },
      { key: 'invoicing', label: 'My Invoices', icon: '🧾' },
    ];

  return (
    <div className="ops">
      <aside className="ops-side">
        <Logo size={18} theme="dark" tagline />
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 11, background: isHQ ? 'rgba(199,255,51,.12)' : 'rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1.5px', color: 'rgba(255,255,255,.4)' }}>{isHQ ? 'HQ CONSOLE' : 'WAREHOUSE CONSOLE'}</div>
          <div style={{ color: '#fff', fontWeight: 800, marginTop: 3 }}>{scope.name}</div>
        </div>
        <nav className="ops-nav">
          {nav.map((n) => (
            <button key={n.key} className={view === n.key ? 'active' : ''} onClick={() => setView(n.key)}>
              <span style={{ fontSize: 17 }}>{n.icon}</span>{n.label}
              {n.badge ? <span style={{ marginLeft: 'auto', background: 'var(--lime)', color: 'var(--navy)', fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 999 }}>{n.badge}</span> : null}
            </button>
          ))}
        </nav>
        <button onClick={switchConsole} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,.6)', fontSize: 13, padding: '10px 0' }}>
          <Avatar name={scope.name} size={32} /> Switch console ↺
        </button>
      </aside>
      <main className="ops-main">
        {view === 'dashboard' && <Dashboard stats={stats} onGo={setView} scope={scope} />}
        {view === 'orders' && <OrdersBoard facilityId={facilityId} isHQ={isHQ} />}
        {view === 'facility' && <Facility facilityId={facilityId} />}
        {view === 'drivers' && isHQ && <Drivers />}
        {view === 'customers' && isHQ && <CustomersView />}
        {view === 'warehouses' && isHQ && <WarehousesView />}
        {view === 'settings' && isHQ && <RoutingSettings />}
        {view === 'tags' && <TagStation facilityId={facilityId} isHQ={isHQ} />}
        {view === 'support' && (isHQ ? <SupportInbox opsId={scope?.opsId} /> : <FacilitySupport opsId={scope?.opsId} />)}
        {view === 'invoicing' && <InvoicingDashboard facilityId={facilityId} isHQ={isHQ} />}
      </main>
    </div>
  );
}

// pick which console to log into: HQ (all warehouses) or a specific warehouse
function ConsolePicker({ onPick }) {
  const [facilities, setFacilities] = useState([]);
  useEffect(() => { api.get('/api/facilities').then(setFacilities); }, []);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <Logo size={26} theme="dark" tagline />
        </div>
        <div style={{ color: 'rgba(255,255,255,.6)', textAlign: 'center', marginBottom: 22, fontSize: 15 }}>Choose your console</div>
        <div className="ops-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <button onClick={() => onPick({ opsId: 'ops_hq', facilityId: null, isHQ: true, name: 'HQ Console' })}
            style={{ textAlign: 'left', background: 'var(--lime)', color: 'var(--navy)', borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 26 }}>🏢</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>HQ Console</div>
            <div style={{ fontSize: 13, opacity: .7, marginTop: 2 }}>All warehouses · route orders · drivers · support</div>
          </button>
          {facilities.map((f) => (
            <button key={f.id} onClick={() => onPick({ opsId: f.id.replace('wh_', 'ops_'), facilityId: f.id, isHQ: false, name: f.name })}
              style={{ textAlign: 'left', background: '#fff', color: 'var(--navy)', borderRadius: 16, padding: 22 }}>
              <div style={{ fontSize: 26 }}>🏭</div>
              <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>{f.name}</div>
              <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>{f.code} · {f.area} · {f.postcode}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── DASHBOARD
function Dashboard({ stats, onGo, scope }) {
  if (!stats) return <Skel />;
  const isHQ = scope?.isHQ;
  const cards = [
    { label: 'Active orders', value: stats.active, icon: '📦', go: 'orders' },
    { label: isHQ ? 'Awaiting routing' : 'Awaiting driver', value: stats.unassigned, icon: '⚠️', accent: stats.unassigned > 0, go: 'orders' },
    { label: 'In facility', value: stats.at_facility, icon: '🏭', go: 'facility' },
    { label: 'In transit', value: stats.in_transit, icon: '🚚', accent: stats.in_transit > 0, go: 'facility' },
    ...(isHQ ? [
      { label: 'Drivers on shift', value: stats.drivers_on_shift, icon: '🚚', go: 'drivers' },
      { label: 'Open tickets', value: stats.open_threads, icon: '💬', go: 'support' },
    ] : []),
    { label: 'Revenue (paid)', value: fmt.money(stats.revenue_cents), icon: '💷' },
  ];
  return (
    <>
      <div className="ops-h1">{isHQ ? 'Operations — HQ' : scope?.name}</div>
      <p className="cl-muted" style={{ marginBottom: 22 }}>{isHQ ? 'All warehouses · live overview' : 'Your warehouse · live overview'}</p>
      <div className="ops-grid stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="cl-card" onClick={c.go ? () => onGo(c.go) : undefined}
            style={{ cursor: c.go ? 'pointer' : 'default', borderLeft: c.accent ? '4px solid var(--warn)' : '4px solid var(--lime)' }}>
            <div className="cl-between"><span className="cl-eyebrow">{c.label}</span><span style={{ fontSize: 18 }}>{c.icon}</span></div>
            <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8, color: 'var(--navy)' }}>{c.value}</div>
          </div>
        ))}
      </div>
      <LiveMapPanel />
    </>
  );
}

function LiveMapPanel() {
  const [drivers, setDrivers] = useState([]);
  const load = useCallback(() => api.get('/api/ops/drivers').then(setDrivers), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'driver:location': load, 'driver:shift': load }, { role: 'ops' }, []);
  const onShift = drivers.filter((d) => d.shift && d.location);
  return (
    <div className="cl-card" style={{ marginTop: 20 }}>
      <div className="cl-eyebrow" style={{ marginBottom: 12 }}>Fleet — live positions</div>
      {onShift.length === 0 ? <Empty icon="🗺️" title="No drivers broadcasting" sub="Locations appear when drivers start a route" /> :
        <OneMap driver={onShift[0].location} dest={null} height={240} />}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {onShift.map((d) => <Chip key={d.id} variant="navy">🚚 {d.name} · {d.active_jobs} jobs</Chip>)}
      </div>
    </div>
  );
}

// ───────────────────────── ORDERS BOARD
function OrdersBoard({ facilityId, isHQ }) {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [customers, setCustomers] = useState([]);

  const load = useCallback(async () => {
    setOrders(await api.get('/api/ops/orders' + qs(facilityId)));
    setDrivers(await api.get('/api/ops/drivers'));
  }, [facilityId]);
  useEffect(() => {
    load();
    api.get('/api/facilities').then(setFacilities);
    api.get('/api/catalog').then(setCatalog);
    api.get('/api/users?role=customer').then(setCustomers);
  }, [load]);
  useSocket({ 'order:updated': load, 'order:new': load }, { role: 'ops' }, [facilityId]);

  const assignDriver = async (orderId, driver_id) => { await api.post(`/api/orders/${orderId}/assign`, { driver_id }); load(); };
  const assignFacility = async (orderId, facility_id) => { await api.post(`/api/orders/${orderId}/assign-facility`, { facility_id }); load(); };
  const filtered = filter === 'all' ? orders : filter === 'active' ? orders.filter((o) => !['completed', 'cancelled'].includes(o.status)) : orders.filter((o) => o.status === filter);

  // nearest active warehouse to an order's address (for smart routing)
  const nearest = (o) => {
    if (!o.address?.lat) return null;
    let best = null, bestKm = Infinity;
    for (const f of facilities) {
      if (f.lat == null) continue;
      const km = distKm(o.address, f);
      if (km != null && km < bestKm) { bestKm = km; best = f; }
    }
    return best ? { ...best, km: bestKm } : null;
  };

  const addrText = (o) => o.address ? `${o.address.area || o.address.line1 || ''}${o.address.postcode ? ` · ${o.address.postcode}` : ''}` : (o.customer?.role === 'business' ? 'Warehouse drop-off' : '—');

  const exportCsv = () => {
    const head = ['Order', 'Customer', 'Type', 'Status', 'Address', 'Postcode', 'Warehouse', 'Driver', 'Total', 'Payment', 'Created'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = orders.map((o) => [o.code, o.customer?.name, o.customer?.role === 'business' ? 'B2B' : 'Consumer', o.status_label || o.status,
      o.address?.line1 || '', o.address?.postcode || '', o.facility?.name || '', o.driver?.name || '', (o.total_cents / 100).toFixed(2), o.payment_status, (o.created_at || '').slice(0, 10)]);
    const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 18 }}>
        <div>
          <div className="ops-h1">{isHQ ? 'Orders & routing' : 'My orders'}</div>
          <p className="cl-muted">{isHQ ? 'Route each order to a warehouse, then assign a driver' : 'Orders routed to your warehouse'}</p>
        </div>
        <div className="cl-row" style={{ gap: 10 }}>
          <select className="ops-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option><option value="active">Active</option>
            {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Button variant="ghost" onClick={exportCsv}>⬇ Export</Button>
          {isHQ && <Button variant="ghost" onClick={() => setImporting(true)}>⬆ Import</Button>}
          <Button variant="lime" onClick={() => setCreating(true)}>+ New order</Button>
        </div>
      </div>
      <table className="ops-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Address</th><th>Status</th><th>Warehouse</th><th>Driver</th><th>Total</th><th>Pay</th></tr></thead>
        <tbody>
          {filtered.map((o) => {
            const near = isHQ && !o.facility_id ? nearest(o) : null;
            return (
            <tr key={o.id} className="click" onClick={() => setSel(o.id)}>
              <td style={{ fontWeight: 800 }}>{o.code}</td>
              <td>{o.customer?.name} {o.customer?.role === 'business' && <Chip variant="navy">B2B</Chip>}</td>
              <td className="cl-muted" style={{ fontSize: 13, maxWidth: 200 }}>{addrText(o)}</td>
              <td><StatusPill status={o.status} label={o.status_label} /></td>
              <td onClick={(e) => e.stopPropagation()}>
                {isHQ
                  ? <>
                      <select className="ops-select" value={o.facility_id || ''} onChange={(e) => assignFacility(o.id, e.target.value)} style={!o.facility_id ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}>
                        <option value="">Route…</option>
                        {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      {near && <div onClick={() => assignFacility(o.id, near.id)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', cursor: 'pointer', marginTop: 4 }}>📍 Nearest: {near.name} ({near.km.toFixed(1)}km) →</div>}
                    </>
                  : <Chip variant="navy">{o.facility?.name || '—'}</Chip>}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <select className="ops-select" value={o.driver_id || ''} onChange={(e) => assignDriver(o.id, e.target.value)}>
                  <option value="" disabled>Assign…</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.shift ? ' ●' : ''}</option>)}
                </select>
              </td>
              <td style={{ fontWeight: 700 }}>{fmt.money(o.total_cents)}</td>
              <td><Chip variant={o.payment_status === 'paid' ? 'navy' : 'gray'}>{o.payment_status}</Chip></td>
            </tr>
          ); })}
        </tbody>
      </table>
      {filtered.length === 0 && <Empty icon="📦" title={isHQ ? 'No orders match' : 'Nothing routed to your warehouse yet'} />}
      {sel && <OrderDrawer orderId={sel} facilityId={facilityId} isHQ={isHQ} onClose={() => { setSel(null); load(); }} />}
      {creating && <NewOrderModal facilityId={facilityId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
      {importing && <ImportModal title="orders" columns={['type', 'customer', 'item', 'qty', 'weight_kg', 'unit_price', 'warehouse']}
        sample={['business', 'Marina Bay Hotel', 'Wash & Fold', '', '40', '2.80', 'Central Hub']}
        onClose={() => setImporting(false)} onDone={load}
        onRow={async (r) => {
          const cat = findBy(catalog, r.item); if (!cat) throw new Error(`Unknown item: ${r.item}`);
          const fac = r.warehouse ? findBy(facilities, r.warehouse) : null;
          const item = { catalog_id: cat.id, qty: Number(r.qty) || (r.weight_kg ? undefined : 1), weight_kg: Number(r.weight_kg) || undefined };
          if (r.unit_price) item.unit_cents = Math.round(parseFloat(r.unit_price) * 100);
          const body = { items: [item], facility_id: fac?.id || null };
          if ((r.type || '').toLowerCase().startsWith('b') || /hotel|gym|spa|hostel|inc|ltd|pte/i.test(r.customer)) body.business_name = r.customer;
          else { const cu = findBy(customers, r.customer); if (!cu) throw new Error(`Unknown customer: ${r.customer}`); body.customer_id = cu.id; }
          await api.post('/api/orders', body);
        }} />}
    </>
  );
}

// HQ/warehouse creates an order on behalf of a customer (walk-in / phone-in)
function NewOrderModal({ facilityId, onClose, onCreated }) {
  const [mode, setMode] = useState('consumer'); // consumer | business
  const [customers, setCustomers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [custId, setCustId] = useState('');
  const [bizName, setBizName] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState('');
  const [cart, setCart] = useState({});
  const [facId, setFacId] = useState(facilityId || '');
  const [drvId, setDrvId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/users?role=customer').then(setCustomers);
    api.get('/api/ops/businesses').then(setBusinesses);
    api.get('/api/catalog').then(setCatalog);
    api.get('/api/facilities').then(setFacilities);
    api.get('/api/ops/drivers').then(setDrivers);
  }, []);
  useEffect(() => {
    if (!custId) { setAddresses([]); setAddrId(''); return; }
    api.get(`/api/customers/${custId}/summary`).then((s) => { setAddresses(s.addresses || []); setAddrId((s.addresses?.find((a) => a.is_default) || s.addresses?.[0])?.id || ''); });
  }, [custId]);

  const isBiz = mode === 'business';
  const setItem = (cid, patch) => setCart((c) => ({ ...c, [cid]: { ...c[cid], ...patch } }));
  // unit price in cents — B2B can override the catalog rate at runtime
  const unitCents = (c, v) => (isBiz && v.unit != null && v.unit !== '' ? Math.round((parseFloat(v.unit) || 0) * 100) : c.price_cents);
  const lineCents = (c, v) => { const n = c.unit === 'per_kg' ? (v.weight || 0) : (v.qty || 0); return Math.round(unitCents(c, v) * n); };
  const items = catalog.filter((c) => { const v = cart[c.id] || {}; return (v.qty || v.weight) > 0; }).map((c) => {
    const v = cart[c.id] || {};
    return { catalog_id: c.id, qty: v.qty, weight_kg: v.weight, ...(isBiz ? { unit_cents: unitCents(c, v) } : {}) };
  });
  const subtotalCents = catalog.reduce((s, c) => s + lineCents(c, cart[c.id] || {}), 0);
  const ready = items.length && (isBiz ? bizName.trim() : custId);

  const [err, setErr] = useState('');
  const create = async () => {
    setBusy(true); setErr('');
    try {
      const body = isBiz
        ? { business_name: bizName.trim(), business_phone: bizPhone || null, items, facility_id: facId || null, driver_id: drvId || null, pickup_slot: 'Warehouse intake', notes: 'B2B order (created by ops)' }
        : { customer_id: custId, address_id: addrId || null, items, facility_id: facId || null, driver_id: drvId || null, pickup_slot: 'Warehouse intake', notes: 'Created by ops' };
      const o = await api.post('/api/orders', body);
      onCreated(o);
    } catch (e) { setErr(e.message || 'Could not create order.'); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,64,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="cl-card" style={{ width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="cl-between" style={{ marginBottom: 14 }}><b style={{ fontSize: 18 }}>New warehouse order</b><button onClick={onClose} style={{ fontSize: 20, color: 'var(--gray)' }}>✕</button></div>

        {/* consumer vs B2B */}
        <div style={{ display: 'flex', background: 'var(--light)', borderRadius: 12, padding: 4, marginBottom: 14 }}>
          {[['consumer', '👤 Consumer'], ['business', '🏢 Business (B2B)']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, fontWeight: 700, fontSize: 14, background: mode === k ? 'var(--navy)' : 'transparent', color: mode === k ? '#fff' : 'var(--gray)' }}>{l}</button>
          ))}
        </div>

        {isBiz ? (
          <>
            <span className="cl-label">Business / client name</span>
            <input className="cl-field" list="biz-list" placeholder="e.g. Marina Bay Hotel" value={bizName} onChange={(e) => setBizName(e.target.value)} style={{ marginBottom: 12 }} />
            <datalist id="biz-list">{businesses.map((b) => <option key={b.id} value={b.name} />)}</datalist>
            <span className="cl-label">Contact phone (optional)</span>
            <input className="cl-field" placeholder="6xxx xxxx" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} style={{ marginBottom: 12 }} />
            <div className="cl-muted" style={{ fontSize: 12, marginBottom: 12 }}>🧾 No app account — billed on invoice terms (no upfront payment).</div>
          </>
        ) : (
          <>
            <span className="cl-label">Customer</span>
            <select className="cl-field" value={custId} onChange={(e) => setCustId(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="">— Select customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.email || c.phone}</option>)}
            </select>
            {custId && (
              <>
                <span className="cl-label">Pickup address</span>
                <select className="cl-field" value={addrId} onChange={(e) => setAddrId(e.target.value)} style={{ marginBottom: 12 }}>
                  <option value="">No address (warehouse drop-off)</option>
                  {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.line1}, {a.postcode}</option>)}
                </select>
              </>
            )}
          </>
        )}

        <div className="cl-between">
          <span className="cl-label">Items</span>
          {isBiz && <span className="cl-muted" style={{ fontSize: 11 }}>✎ edit unit price for contract rates</span>}
        </div>
        <div style={{ marginBottom: 12 }}>
          {catalog.map((c) => {
            const v = cart[c.id] || {};
            const per = c.unit === 'per_kg';
            const val = per ? (v.weight || 0) : (v.qty || 0);
            const step = per ? 0.5 : 1;
            return (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray3)' }}>
                <div className="cl-between">
                  <span>{c.icon} {c.name} <span className="cl-muted" style={{ fontSize: 12 }}>{fmt.money(c.price_cents)}/{per ? 'kg' : 'item'}</span></span>
                  <div className="cl-row" style={{ gap: 8 }}>
                    <button onClick={() => setItem(c.id, per ? { weight: Math.max(0, +(val - step).toFixed(1)) } : { qty: Math.max(0, val - step) })} style={stepBtn}>−</button>
                    <b style={{ minWidth: 40, textAlign: 'center' }}>{val || 0}{per && val ? 'kg' : ''}</b>
                    <button onClick={() => setItem(c.id, per ? { weight: +(val + step).toFixed(1) } : { qty: val + step })} style={{ ...stepBtn, background: 'var(--navy)', color: '#fff' }}>+</button>
                  </div>
                </div>
                {isBiz && val > 0 && (
                  <div className="cl-between" style={{ marginTop: 6 }}>
                    <label className="cl-row" style={{ gap: 6, fontSize: 12 }}>
                      <span className="cl-muted">Contract S$ / {per ? 'kg' : 'item'}</span>
                      <input className="cl-field" style={{ width: 86, padding: '6px 8px' }} value={v.unit ?? (c.price_cents / 100)} onChange={(e) => setItem(c.id, { unit: e.target.value })} />
                    </label>
                    <b>{fmt.money(lineCents(c, v))}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {subtotalCents > 0 && <div className="cl-between" style={{ marginBottom: 12, fontWeight: 800, fontSize: 16 }}><span>{isBiz ? 'Order total (invoiced)' : 'Subtotal'}</span><span>{fmt.money(subtotalCents)}</span></div>}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <label style={{ flex: 1 }}><span className="cl-label">Warehouse</span>
            <select className="cl-field" value={facId} onChange={(e) => setFacId(e.target.value)}><option value="">Route later</option>{facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label style={{ flex: 1 }}><span className="cl-label">Driver</span>
            <select className="cl-field" value={drvId} onChange={(e) => setDrvId(e.target.value)}><option value="">Assign later</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.shift ? ' ●' : ''}</option>)}</select></label>
        </div>

        {err && <div style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 10 }}>{err}</div>}
        <Button variant="lime" disabled={busy || !ready} onClick={create}>{busy ? 'Creating…' : isBiz ? 'Create & start processing' : 'Create order'}</Button>
        {isBiz && <div className="cl-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>{facId ? 'Order starts at the warehouse — ready to tag & scan.' : 'Tip: pick a warehouse to start processing immediately.'}</div>}
      </div>
    </div>
  );
}
const stepBtn = { width: 30, height: 30, borderRadius: 30, background: 'var(--gray3)', fontSize: 17, fontWeight: 800, color: 'var(--navy)' };

// reusable CSV import dialog — onRow(rowObj) creates one record
function ImportModal({ title, columns, sample, onRow, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onFile = async (e) => { const f = e.target.files?.[0]; if (!f) return; setRows(parseCsv(await f.text())); setResult(null); };
  const run = async () => {
    setBusy(true); let ok = 0, fail = 0; const errs = [];
    for (const r of rows) { try { await onRow(r); ok++; } catch (e) { fail++; if (errs.length < 4) errs.push(e.message || 'error'); } }
    setBusy(false); setResult({ ok, fail, errs }); onDone?.();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,64,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="cl-card" style={{ width: 520, maxWidth: '100%' }}>
        <div className="cl-between" style={{ marginBottom: 12 }}><b style={{ fontSize: 18 }}>Import {title}</b><button onClick={onClose} style={{ fontSize: 20, color: 'var(--gray)' }}>✕</button></div>
        <p className="cl-muted" style={{ fontSize: 13, marginBottom: 12 }}>Upload a CSV with columns: <b style={{ color: 'var(--navy)' }}>{columns.join(', ')}</b></p>
        <Button sm variant="ghost" onClick={() => downloadCsv(`${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`, columns, [sample])} style={{ marginBottom: 14 }}>⬇ Download template</Button>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="cl-field" style={{ marginBottom: 14 }} />
        {result ? (
          <div style={{ background: 'var(--lime-pale)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <b>✓ {result.ok} imported</b>{result.fail ? `, ${result.fail} failed` : ''}
            {result.errs?.length > 0 && <div className="cl-muted" style={{ fontSize: 12, marginTop: 6 }}>{result.errs.join(' · ')}</div>}
          </div>
        ) : rows && <div className="cl-muted" style={{ fontSize: 13, marginBottom: 12 }}>{rows.length} row{rows.length === 1 ? '' : 's'} ready to import.</div>}
        {result
          ? <Button variant="lime" onClick={onClose}>Done</Button>
          : <Button variant="lime" disabled={!rows?.length || busy} onClick={run}>{busy ? 'Importing…' : `Import ${rows?.length || 0} rows`}</Button>}
      </div>
    </div>
  );
}
const findBy = (list, name, key = 'name') => list.find((x) => (x[key] || '').toLowerCase() === String(name || '').trim().toLowerCase());

function OrderDrawer({ orderId, onClose, facilityId, isHQ }) {
  const [o, setO] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [dest, setDest] = useState('');
  const [reason, setReason] = useState('');
  const reload = useCallback(() => api.get(`/api/orders/${orderId}`).then(setO), [orderId]);
  useEffect(() => { reload(); api.get('/api/facilities').then(setFacilities); }, [reload]);
  if (!o) return null;
  const idx = STATUS_FLOW.indexOf(o.status);
  const nextStatus = STATUS_FLOW[idx + 1];
  const setStatus = async (s) => { await api.post(`/api/orders/${orderId}/status`, { status: s }); reload(); };
  const sendTransfer = async () => { if (!dest) return; await api.post(`/api/orders/${orderId}/transfer`, { to_facility_id: dest, reason }); setDest(''); setReason(''); reload(); };
  const receiveTransfer = async () => { await api.post(`/api/transfers/${o.transfer.id}/receive`, {}); reload(); };
  const canReceive = o.transfer && (isHQ || facilityId === o.transfer.to_facility_id);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="cl-between" style={{ marginBottom: 16 }}>
          <div><div style={{ fontWeight: 900, fontSize: 22 }}>{o.code}</div><StatusPill status={o.status} label={o.status_label} /></div>
          <button onClick={onClose} style={{ fontSize: 22 }}>✕</button>
        </div>
        <div className="cl-card" style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Customer</div>
          <div style={{ fontWeight: 700 }}>{o.customer?.name}</div>
          <div className="cl-muted" style={{ fontSize: 13 }}>{o.customer?.phone} · {o.customer?.email}</div>
          <div className="cl-muted" style={{ fontSize: 13, marginTop: 6 }}>📍 {o.address?.line1}, {o.address?.postcode}</div>
          <div style={{ marginTop: 8 }}>Driver: <b>{o.driver?.name || 'Unassigned'}</b></div>
          <div style={{ marginTop: 4 }}>Warehouse: <b>{o.facility?.name || 'Unrouted'}</b>{o.facility ? <span className="cl-muted"> · {o.facility.line1}, {o.facility.postcode}</span> : null}</div>
          <div className="cl-row" style={{ gap: 8, marginTop: 12 }}>
            <Button sm variant="ghost" onClick={() => printInvoice(o)}>🧾 Generate invoice</Button>
          </div>
        </div>

        {/* inter-warehouse transfer */}
        {o.facility && <div className="cl-card" style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Inter-warehouse transfer</div>
          {o.transfer ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>🚚</span> In transit: {o.transfer.from?.name || '—'} → {o.transfer.to?.name}
              </div>
              {o.transfer.reason && <div className="cl-muted" style={{ fontSize: 13, marginBottom: 10 }}>“{o.transfer.reason}”</div>}
              {canReceive
                ? <Button sm variant="lime" onClick={receiveTransfer}>✓ Confirm receipt at {o.transfer.to?.name}</Button>
                : <Chip variant="gray">awaiting receipt at {o.transfer.to?.name}</Chip>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="ops-select" value={dest} onChange={(e) => setDest(e.target.value)} style={{ flex: 1 }}>
                <option value="">Transfer to…</option>
                {facilities.filter((f) => f.id !== o.facility_id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input className="cl-field" placeholder="Reason (e.g. leather specialist)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1.5 }} />
              <Button sm variant="ghost" disabled={!dest} onClick={sendTransfer}>Send →</Button>
            </div>
          )}
        </div>}
        <div className="cl-card" style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Items · {fmt.money(o.total_cents)}</div>
          {o.items.map((i) => <div key={i.id} className="cl-between" style={{ fontSize: 14, padding: '4px 0' }}><span>{i.name}{i.weight_kg ? ` (${i.weight_kg}kg)` : i.qty > 1 ? ` ×${i.qty}` : ''}</span><span className="cl-muted">{fmt.money(i.price_cents)}</span></div>)}
        </div>
        {o.garments?.length > 0 && <div className="cl-card" style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Garments ({o.garments.length})</div>
          {o.garments.map((g) => <div key={g.id} className="cl-between" style={{ fontSize: 13, padding: '4px 0' }}><span>{g.type} · {g.color}</span><Chip>{GARMENT_LABEL[g.status]}</Chip></div>)}
        </div>}
        {nextStatus && o.status !== 'cancelled' && <Button variant="lime" style={{ marginBottom: 10 }} onClick={() => setStatus(nextStatus)}>Advance → {STATUS_LABEL[nextStatus]}</Button>}
        {!['completed', 'cancelled'].includes(o.status) && <Button variant="ghost" onClick={() => setStatus('cancelled')}>Cancel order</Button>}
      </div>
    </>
  );
}

// ───────────────────────── FACILITY (clothes tracking + tagging)
function Facility({ facilityId }) {
  const [orders, setOrders] = useState([]);
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState('board'); // board | scan
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    const all = await api.get('/api/ops/orders' + qs(facilityId));
    setOrders(all.filter((o) => ['picked_up', 'at_facility', 'processing', 'ready'].includes(o.status)));
  }, [facilityId]);
  const [transfers, setTransfers] = useState([]);
  const loadTransfers = useCallback(() => api.get('/api/ops/transfers' + qs(facilityId)).then(setTransfers), [facilityId]);
  useEffect(() => { load(); loadTransfers(); }, [load, loadTransfers]);
  useSocket({ 'order:updated': () => { load(); loadTransfers(); }, 'garment:updated': load, 'transfer:new': loadTransfers, 'transfer:updated': () => { load(); loadTransfers(); } }, { role: 'ops' }, [facilityId]);
  const current = orders.find((o) => o.id === sel) || orders[0];
  const receive = async (tid) => { await api.post(`/api/transfers/${tid}/receive`, {}); load(); loadTransfers(); };

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 18 }}>
        <div><div className="ops-h1">Facility</div><p className="cl-muted">Tag, track & scan every garment through the cleaning pipeline</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button sm variant={tab === 'board' ? 'navy' : 'ghost'} onClick={() => setTab('board')}>📋 Order board</Button>
          <Button sm variant={tab === 'scan' ? 'navy' : 'ghost'} onClick={() => setTab('scan')}>📷 Scan station</Button>
          <Button sm variant="lime" onClick={() => setCreating(true)}>+ Take in order</Button>
        </div>
      </div>
      {creating && <NewOrderModal facilityId={facilityId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}

      {transfers.length > 0 && tab === 'board' && (
        <div className="cl-card" style={{ marginBottom: 16, borderLeft: '4px solid var(--warn)' }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10 }}>🚚 Transfers in transit ({transfers.length})</div>
          {transfers.map((t) => (
            <div key={t.id} className="cl-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray3)' }}>
              <div>
                <b>{t.order?.code}</b> <span className="cl-muted" style={{ fontSize: 13 }}>· {t.from?.name || '—'} → {t.to?.name}</span>
                {t.reason && <div className="cl-muted" style={{ fontSize: 12 }}>“{t.reason}”</div>}
              </div>
              {t.direction === 'incoming'
                ? <Button sm variant="lime" onClick={() => receive(t.id)}>✓ Receive</Button>
                : <Chip variant="gray">{t.direction === 'outgoing' ? 'sent out' : 'in transit'}</Chip>}
            </div>
          ))}
        </div>
      )}

      {tab === 'scan' ? <ScanStation /> :
        orders.length === 0 ? <Empty icon="🏭" title="Nothing in the facility" sub="Orders appear here once picked up" /> :
          <div className="ops-2col">
            <FacilityBoard order={current} onReload={load} />
            <div>
              <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Orders in facility</div>
              {orders.map((o) => (
                <div key={o.id} className="cl-card" onClick={() => setSel(o.id)} style={{ marginBottom: 10, cursor: 'pointer', border: current?.id === o.id ? '2px solid var(--navy)' : '2px solid transparent' }}>
                  <div className="cl-between"><b>{o.code}</b><StatusPill status={o.status} label={o.status_label} /></div>
                  <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>{o.customer?.name} · {o.garments?.length || 0} garments</div>
                </div>
              ))}
            </div>
          </div>}
    </>
  );
}

function FacilityBoard({ order, onReload }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: '', color: '', weight_kg: '', care: '' });
  const [labelsFor, setLabelsFor] = useState(null);
  const [expanded, setExpanded] = useState(null);
  if (!order) return null;
  const setG = async (gid, status) => { await api.post(`/api/garments/${gid}/status`, { status }); onReload(); };
  const advG = async (gid) => { await api.post(`/api/garments/${gid}/advance`, { actor: 'ops' }); onReload(); };
  const addG = async () => { await api.post(`/api/orders/${order.id}/garments`, { ...form, weight_kg: form.weight_kg ? Number(form.weight_kg) : null }); setForm({ type: '', color: '', weight_kg: '', care: '' }); setAdding(false); onReload(); };
  const advanceOrder = async (s) => { await api.post(`/api/orders/${order.id}/status`, { status: s }); onReload(); };

  return (
    <div className="cl-card">
      <div className="cl-between" style={{ marginBottom: 14 }}>
        <div><b style={{ fontSize: 18 }}>{order.code}</b> <span className="cl-muted">· {order.customer?.name}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {order.status === 'picked_up' && <Button sm variant="ghost" onClick={() => advanceOrder('at_facility')}>Check in →</Button>}
          {order.status === 'at_facility' && <Button sm variant="ghost" onClick={() => advanceOrder('processing')}>Start cleaning →</Button>}
          {order.status === 'processing' && <Button sm variant="lime" onClick={() => advanceOrder('ready')}>Mark ready →</Button>}
          {order.garments.length > 0 && <Button sm variant="ghost" onClick={() => setLabelsFor(order)}>🏷️ Print tags</Button>}
          <Button sm variant="ghost" onClick={() => setAdding((x) => !x)}>+ Intake</Button>
        </div>
      </div>

      {adding && <div className="cl-card" style={{ background: 'var(--light)', marginBottom: 14 }}>
        <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Check in & tag a garment</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr', gap: 8, marginBottom: 8 }}>
          <input className="cl-field" placeholder="Type (e.g. Shirt)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <input className="cl-field" placeholder="Colour" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <input className="cl-field" placeholder="kg" type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="cl-field" placeholder="Care note (e.g. 30° gentle, warm iron)" value={form.care} onChange={(e) => setForm({ ...form, care: e.target.value })} />
          <Button sm variant="lime" disabled={!form.type} onClick={addG} style={{ whiteSpace: 'nowrap' }}>Tag & add</Button>
        </div>
      </div>}

      {order.garments.length === 0 ? <Empty icon="👕" title="No garments tagged yet" sub="Use + Intake to check garments in" /> :
        <table className="ops-table" style={{ boxShadow: 'none' }}>
          <thead><tr><th>Tag</th><th>Item</th><th>Stage</th><th></th></tr></thead>
          <tbody>
            {order.garments.map((g) => (
              <React.Fragment key={g.id}>
                <tr>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }} className="click" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>🏷️ {g.tag_code}</td>
                  <td>{g.type} <span className="cl-muted">· {g.color}{g.weight_kg ? ` · ${g.weight_kg}kg` : ''}</span></td>
                  <td>
                    <select className="ops-select" value={g.status} onChange={(e) => setG(g.id, e.target.value)}>
                      {GARMENT_FLOW.map((s) => <option key={s} value={s}>{GARMENT_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td>{g.status !== 'returned' && <Button sm variant="ghost" onClick={() => advG(g.id)}>Advance →</Button>}</td>
                </tr>
                {expanded === g.id && <tr><td colSpan={4} style={{ background: 'var(--light)' }}>
                  {g.care && <div style={{ fontSize: 12, marginBottom: 8 }}><b>Care:</b> {g.care}</div>}
                  <GarmentJourney garment={g} />
                </td></tr>}
              </React.Fragment>
            ))}
          </tbody>
        </table>}

      {labelsFor && <QrLabels order={labelsFor} onClose={() => setLabelsFor(null)} />}
    </div>
  );
}

// scan-to-progress station: type/scan a tag → load garment → advance stage
function ScanStation() {
  const [tag, setTag] = useState('');
  const [g, setG] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const lookup = async (code) => {
    setErr('');
    try { setG(await api.get(`/api/garments/by-tag/${encodeURIComponent(code.trim().toUpperCase())}`)); }
    catch { setG(null); setErr(`No garment found for "${code}"`); }
  };
  const scanAdvance = async () => {
    const r = await api.post(`/api/garments/by-tag/${encodeURIComponent(g.tag_code)}/advance`, {});
    setG({ ...g, status: r.status, events: r.events });
  };

  return (
    <div className="ops-2col">
      <div className="cl-card">
        <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Scan or type a tag</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input ref={inputRef} className="cl-field" placeholder="e.g. CL-1042-01" value={tag}
            onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup(tag)} style={{ fontFamily: 'monospace' }} />
          <Button sm variant="navy" onClick={() => lookup(tag)}>Look up</Button>
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        <p className="cl-muted" style={{ fontSize: 12 }}>In production a handheld barcode scanner types the tag here and hits Enter — the garment auto-advances to the next stage.</p>
      </div>

      <div className="cl-card">
        {!g ? <Empty icon="📷" title="Ready to scan" sub="Look up a tag to see its journey" /> : <>
          <div className="cl-between" style={{ marginBottom: 6 }}>
            <div><b style={{ fontSize: 18 }}>{g.tag_code}</b><div className="cl-muted" style={{ fontSize: 13 }}>{g.type} · {g.color} · {g.order?.code}</div></div>
            <StatusPill status={'processing'} label={GARMENT_LABEL[g.status]} />
          </div>
          {g.care && <div style={{ fontSize: 13, marginBottom: 10 }}><b>Care:</b> {g.care}</div>}
          <GarmentJourney garment={g} />
          {g.status !== 'returned'
            ? <Button variant="lime" style={{ marginTop: 12 }} onClick={scanAdvance}>✓ Advance to {GARMENT_LABEL[GARMENT_FLOW[GARMENT_FLOW.indexOf(g.status) + 1]]}</Button>
            : <div style={{ marginTop: 12, color: 'var(--ok)', fontWeight: 700 }}>✓ Completed — returned to customer</div>}
        </>}
      </div>
    </div>
  );
}

// printable QR labels for an order's garments
function QrLabels({ order, onClose }) {
  const [codes, setCodes] = useState({});
  useEffect(() => {
    (async () => {
      const out = {};
      for (const g of order.garments) out[g.id] = await QRCode.toDataURL(g.tag_code, { margin: 1, width: 150, color: { dark: '#1D2951', light: '#FFFFFF' } });
      setCodes(out);
    })();
  }, [order]);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="drawer" style={{ width: 540 }}>
        <div className="cl-between" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Tags · {order.code}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button sm variant="lime" onClick={() => window.print()}>🖨️ Print</Button>
            <button onClick={onClose} style={{ fontSize: 22 }}>✕</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {order.garments.map((g) => (
            <div key={g.id} className="cl-card" style={{ textAlign: 'center', border: '1.5px dashed var(--gray3)' }}>
              {codes[g.id] ? <img src={codes[g.id]} width={130} height={130} alt={g.tag_code} /> : <div className="cl-skel" style={{ width: 130, height: 130, margin: '0 auto' }} />}
              <div style={{ fontFamily: 'monospace', fontWeight: 800, marginTop: 6 }}>{g.tag_code}</div>
              <div className="cl-muted" style={{ fontSize: 12 }}>{g.type} · {g.color}</div>
              {g.care && <div className="cl-muted" style={{ fontSize: 11, marginTop: 2 }}>{g.care}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── DRIVERS
function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [creditFor, setCreditFor] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const load = useCallback(() => api.get('/api/ops/drivers').then(setDrivers), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'driver:shift': load, 'driver:location': load, 'order:updated': load }, { role: 'ops' }, []);

  const addDriver = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await api.post('/api/ops/drivers', form);
    setBusy(false); setAdding(false); setForm({ name: '', phone: '', email: '' }); load();
  };

  const located = drivers.filter((d) => d.location).map((d) => ({ id: d.id, name: d.name, lat: d.location.lat, lng: d.location.lng }));

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 6 }}>
        <div className="ops-h1">Drivers</div>
        <div className="cl-row" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={() => downloadCsv('drivers.csv', ['name', 'email', 'phone', 'on_shift', 'active_jobs'],
            drivers.map((d) => [d.name, d.email, d.phone, d.shift ? 'yes' : 'no', d.active_jobs]))}>⬇ Export</Button>
          <Button variant="ghost" onClick={() => setImporting(true)}>⬆ Import</Button>
          <Button variant="lime" onClick={() => setAdding((x) => !x)}>{adding ? 'Cancel' : '+ Add driver'}</Button>
        </div>
      </div>
      <p className="cl-muted" style={{ marginBottom: 18 }}>Shift status, live workload & real-time location</p>
      {importing && <ImportModal title="drivers" columns={['name', 'email', 'phone']}
        sample={['Wei Jie Koh', 'weijie@chaselaundry.com', '8155 2020']}
        onClose={() => setImporting(false)} onDone={load}
        onRow={async (r) => { await api.post('/api/ops/drivers', r); }} />}

      {adding && (
        <div className="cl-card" style={{ marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 160 }}><span className="cl-label">Name</span><input className="cl-field" placeholder="Driver name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label style={{ flex: 1, minWidth: 140 }}><span className="cl-label">Phone</span><input className="cl-field" placeholder="9xxx xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label style={{ flex: 1, minWidth: 180 }}><span className="cl-label">Email</span><input className="cl-field" placeholder="name@chaselaundry.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <Button variant="lime" disabled={busy || !form.name.trim()} onClick={addDriver}>{busy ? 'Adding…' : 'Add to fleet'}</Button>
        </div>
      )}

      {/* live fleet map */}
      <div className="cl-card" style={{ marginBottom: 18, padding: 12 }}>
        <div className="cl-between" style={{ marginBottom: 10, padding: '0 4px' }}>
          <b>🛰️ Live fleet map</b>
          <span className="cl-muted" style={{ fontSize: 12 }}>{located.length} driver{located.length === 1 ? '' : 's'} broadcasting · updates in real time</span>
        </div>
        {located.length ? <FleetMap drivers={located} height={360} /> : <Empty icon="🛰️" title="No live locations yet" sub="Driver locations appear here once they're on a job" />}
      </div>

      <div className="ops-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {drivers.map((d) => (
          <div key={d.id} className="cl-card">
            <div className="cl-row" style={{ gap: 12 }}>
              <Avatar name={d.name} size={46} color={d.shift ? 'var(--lime-d)' : 'var(--navy)'} />
              <div>
                <div style={{ fontWeight: 800 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: d.shift ? 'var(--ok)' : 'var(--gray)' }}>{d.shift ? `● On shift since ${fmt.time(d.shift.clock_in)}` : '○ Off shift'}</div>
              </div>
            </div>
            <div className="cl-divider" />
            <div className="cl-between" style={{ fontSize: 13 }}>
              <span className="cl-muted">Active jobs</span><b>{d.active_jobs}</b>
            </div>
            {d.location && <div className="cl-between" style={{ fontSize: 13, marginTop: 6 }}>
              <span className="cl-muted">Last ping</span><b>{fmt.ago(d.location.ts)}</b>
            </div>}
          </div>
        ))}
      </div>
    </>
  );
}

// ───────────────────────── SUPPORT INBOX
// HQ: configure how orders auto-route to warehouses by address
function RoutingSettings() {
  const [cfg, setCfg] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/ops/settings/routing').then(setCfg);
    api.get('/api/facilities').then(setFacilities);
  }, []);
  if (!cfg) return <Empty icon="⚙️" title="Loading settings…" />;

  const set = (patch) => { setCfg((c) => ({ ...c, ...patch })); setSaved(false); };
  const setRule = (i, patch) => set({ rules: cfg.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const addRule = () => set({ rules: [...cfg.rules, { prefix: '', facility_id: facilities[0]?.id || '' }] });
  const delRule = (i) => set({ rules: cfg.rules.filter((_, idx) => idx !== i) });

  const save = async () => { setBusy(true); const next = await api.post('/api/ops/settings/routing', cfg); setCfg(next); setBusy(false); setSaved(true); };

  const strategies = [
    ['nearest', '📍 Nearest warehouse', 'Route to the closest active hub by the pickup address.'],
    ['rules', '🔢 Postcode rules', 'Map postcode prefixes to specific warehouses.'],
    ['default', '🏭 Always default', 'Send every order to one default warehouse.'],
  ];

  return (
    <>
      <div className="ops-h1">Settings · Order routing</div>
      <p className="cl-muted" style={{ marginBottom: 18 }}>How new orders are automatically assigned to a warehouse based on the pickup address.</p>

      <div className="cl-card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <label className="cl-between" style={{ cursor: 'pointer', marginBottom: 4 }}>
          <div><b>Auto-route new orders</b><div className="cl-muted" style={{ fontSize: 13 }}>When off, orders arrive unrouted for manual assignment.</div></div>
          <input type="checkbox" checked={cfg.auto_route} onChange={(e) => set({ auto_route: e.target.checked })} style={{ width: 20, height: 20 }} />
        </label>
      </div>

      {cfg.auto_route && <>
        <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Routing strategy</div>
        <div style={{ display: 'grid', gap: 10, maxWidth: 640, marginBottom: 16 }}>
          {strategies.map(([k, t, d]) => (
            <div key={k} onClick={() => set({ strategy: k })} className="cl-card" style={{ cursor: 'pointer', border: cfg.strategy === k ? '2px solid var(--navy)' : '2px solid transparent' }}>
              <div className="cl-between"><b>{t}</b>{cfg.strategy === k && <span>✓</span>}</div>
              <div className="cl-muted" style={{ fontSize: 13, marginTop: 2 }}>{d}</div>
            </div>
          ))}
        </div>

        {cfg.strategy === 'rules' && (
          <div className="cl-card" style={{ marginBottom: 16, maxWidth: 640 }}>
            <div className="cl-between" style={{ marginBottom: 10 }}><b>Postcode → warehouse</b><Button sm variant="ghost" onClick={addRule}>+ Add rule</Button></div>
            {cfg.rules.length === 0 && <div className="cl-muted" style={{ fontSize: 13 }}>No rules yet. Postcodes that match no rule fall back to the default warehouse.</div>}
            {cfg.rules.map((r, i) => (
              <div key={i} className="cl-row" style={{ gap: 8, marginBottom: 8 }}>
                <span className="cl-muted" style={{ fontSize: 13 }}>Postcode starts with</span>
                <input className="cl-field" style={{ width: 90 }} placeholder="01" value={r.prefix} onChange={(e) => setRule(i, { prefix: e.target.value.replace(/\D/g, '') })} />
                <span className="cl-muted" style={{ fontSize: 13 }}>→</span>
                <select className="cl-field" style={{ flex: 1 }} value={r.facility_id} onChange={(e) => setRule(i, { facility_id: e.target.value })}>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button onClick={() => delRule(i)} style={{ color: 'var(--danger)', fontSize: 16 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="cl-card" style={{ marginBottom: 16, maxWidth: 640 }}>
          <span className="cl-label">Default / fallback warehouse</span>
          <select className="cl-field" value={cfg.default_facility_id || ''} onChange={(e) => set({ default_facility_id: e.target.value || null })}>
            <option value="">— None (leave unrouted) —</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="cl-muted" style={{ fontSize: 12, marginTop: 6 }}>Used for B2B drop-offs and when {cfg.strategy === 'rules' ? 'no postcode rule matches' : 'no address is available'}.</div>
        </div>
      </>}

      <Button variant="lime" disabled={busy} onClick={save}>{busy ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}</Button>
    </>
  );
}

// HQ: add & manage processing warehouses
function WarehousesView() {
  const [facilities, setFacilities] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', phone: '', capacity_kg: 600 });
  const [place, setPlace] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => api.get('/api/ops/facilities').then(setFacilities), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'facility:new': load }, { role: 'ops' }, []);

  const reset = () => { setForm({ name: '', code: '', phone: '', capacity_kg: 600 }); setPlace(null); setErr(''); };
  const add = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.post('/api/ops/facilities', {
        ...form, capacity_kg: Number(form.capacity_kg) || 500,
        line1: place?.line1, area: place?.area, postcode: place?.postcode, lat: place?.lat, lng: place?.lng,
      });
      reset(); setAdding(false); load();
    } catch (e) { setErr(e.message || 'Could not add warehouse.'); }
    finally { setBusy(false); }
  };

  const toggleActive = async (f) => { await api.post(`/api/ops/facilities/${f.id}`, { active: !f.active }); load(); };
  const located = facilities.filter((f) => f.lat).map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng }));

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 12 }}>
        <div className="ops-h1">Warehouses</div>
        <div className="cl-row" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={() => downloadCsv('warehouses.csv', ['name', 'code', 'line1', 'area', 'postcode', 'phone', 'capacity_kg', 'active', 'active_orders'],
            facilities.map((f) => [f.name, f.code, f.line1, f.area, f.postcode, f.phone, f.capacity_kg, f.active ? 'yes' : 'no', f.active_orders]))}>⬇ Export</Button>
          <Button variant="ghost" onClick={() => setImporting(true)}>⬆ Import</Button>
          <Button variant="lime" onClick={() => { setAdding((x) => !x); setErr(''); }}>{adding ? 'Cancel' : '+ Add warehouse'}</Button>
        </div>
      </div>
      <p className="cl-muted" style={{ marginBottom: 16 }}>Processing hubs orders can be routed to.</p>
      {importing && <ImportModal title="warehouses" columns={['name', 'code', 'line1', 'area', 'postcode', 'phone', 'capacity_kg']}
        sample={['North Hub', 'WH-N', '5 Woodlands Ave 9', 'Woodlands', '738964', '6000 1004', '650']}
        onClose={() => setImporting(false)} onDone={load}
        onRow={async (r) => { await api.post('/api/ops/facilities', r); }} />}

      {adding && (
        <div className="cl-card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ flex: 2, minWidth: 180 }}><span className="cl-label">Warehouse name</span><input className="cl-field" placeholder="e.g. North Hub" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label style={{ flex: 1, minWidth: 110 }}><span className="cl-label">Code</span><input className="cl-field" placeholder="WH-N (auto)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label style={{ flex: 1, minWidth: 120 }}><span className="cl-label">Capacity (kg)</span><input className="cl-field" inputMode="numeric" value={form.capacity_kg} onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })} /></label>
            <label style={{ flex: 1, minWidth: 130 }}><span className="cl-label">Phone</span><input className="cl-field" placeholder="6xxx xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
          <span className="cl-label">Address</span>
          {place ? (
            <div className="cl-between cl-card" style={{ background: 'var(--light)', marginBottom: 10 }}>
              <span>📍 <b>{place.name}</b> <span className="cl-muted">· {place.line1}, {place.postcode}</span></span>
              <button onClick={() => setPlace(null)} style={{ fontWeight: 700, color: 'var(--navy)' }}>Change</button>
            </div>
          ) : <div style={{ marginBottom: 10 }}><PlacesAutocomplete onSelect={setPlace} placeholder="Search warehouse address or postcode…" /></div>}
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{err}</div>}
          <Button variant="lime" disabled={busy || !form.name.trim()} onClick={add}>{busy ? 'Adding…' : 'Add warehouse'}</Button>
        </div>
      )}

      {located.length > 0 && (
        <div className="cl-card" style={{ marginBottom: 18, padding: 12 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10, padding: '0 4px' }}>🗺️ Network map ({located.length})</div>
          <FleetMap drivers={located} height={300} />
        </div>
      )}

      <div className="ops-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {facilities.map((f) => (
          <div key={f.id} className="cl-card" style={{ opacity: f.active ? 1 : 0.6 }}>
            <div className="cl-between">
              <div><b style={{ fontSize: 16 }}>{f.name}</b> <Chip variant="navy">{f.code}</Chip></div>
              <button onClick={() => toggleActive(f)} style={{ fontSize: 12, fontWeight: 700, color: f.active ? 'var(--ok)' : 'var(--gray)' }}>{f.active ? '● Active' : '○ Inactive'}</button>
            </div>
            <div className="cl-muted" style={{ fontSize: 13, marginTop: 6 }}>{f.line1 || '—'}{f.postcode ? `, ${f.postcode}` : ''}</div>
            <div className="cl-divider" />
            <div className="cl-between" style={{ fontSize: 13 }}><span className="cl-muted">Capacity</span><b>{f.capacity_kg} kg</b></div>
            <div className="cl-between" style={{ fontSize: 13, marginTop: 4 }}><span className="cl-muted">Active orders</span><b>{f.active_orders}</b></div>
            {f.phone && <div className="cl-between" style={{ fontSize: 13, marginTop: 4 }}><span className="cl-muted">Phone</span>{f.phone}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

// HQ: manage all consumer customers + B2B business clients
function CustomersView() {
  const [tab, setTab] = useState('consumer'); // consumer | business
  const [consumers, setConsumers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', contact_person: '', address: '', gst_no: '', payment_terms: 'Net 30' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [invoiceFor, setInvoiceFor] = useState(null);
  const [importing, setImporting] = useState(false);
  const resetForm = () => setForm({ name: '', email: '', phone: '', contact_person: '', address: '', gst_no: '', payment_terms: 'Net 30' });

  const load = useCallback(() => {
    api.get('/api/ops/customers').then(setConsumers);
    api.get('/api/ops/businesses').then(setBusinesses);
  }, []);
  useEffect(() => { load(); }, [load]);

  const isBiz = tab === 'business';
  const rows = (isBiz ? businesses : consumers).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || (c.email || '').toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q));

  const add = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.post(isBiz ? '/api/ops/businesses' : '/api/ops/customers', form);
      resetForm(); setAdding(false); load();
    } catch (e) { setErr(e.message || 'Could not add.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 12 }}>
        <div className="ops-h1">Customers</div>
        <div className="cl-row" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={() => downloadCsv(`${isBiz ? 'businesses' : 'customers'}.csv`,
            isBiz ? ['name', 'email', 'phone', 'contact_person', 'address', 'gst_no', 'payment_terms'] : ['name', 'email', 'phone', 'plan', 'wallet', 'orders'],
            rows.map((c) => isBiz ? [c.name, c.email, c.phone, c.contact_person, c.address, c.gst_no, c.payment_terms] : [c.name, c.email, c.phone, c.plan, (c.balance_cents / 100).toFixed(2), c.orders]))}>⬇ Export</Button>
          <Button variant="ghost" onClick={() => setImporting(true)}>⬆ Import</Button>
          <Button variant="lime" onClick={() => { setAdding((x) => !x); setErr(''); }}>{adding ? 'Cancel' : isBiz ? '+ Add business' : '+ Add customer'}</Button>
        </div>
      </div>
      {importing && <ImportModal title={isBiz ? 'businesses' : 'customers'}
        columns={isBiz ? ['name', 'email', 'phone', 'contact_person', 'address', 'gst_no', 'payment_terms'] : ['name', 'email', 'phone']}
        sample={isBiz ? ['Marina Bay Hotel', 'ap@mbh.sg', '6688 0000', 'Jane Lim', '10 Bayfront Ave 018956', '20231234A', 'Net 30'] : ['Tan Ah Kow', 'ahkow@example.com', '9111 2222']}
        onClose={() => setImporting(false)} onDone={load}
        onRow={async (r) => { await api.post(isBiz ? '/api/ops/businesses' : '/api/ops/customers', r); }} />}

      <div style={{ display: 'flex', gap: 6, background: '#fff', padding: 6, borderRadius: 12, width: 'fit-content', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
        {[['consumer', `👤 Consumers (${consumers.length})`], ['business', `🏢 B2B clients (${businesses.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setAdding(false); setSel(null); }} style={{ padding: '9px 16px', borderRadius: 9, fontWeight: 700, fontSize: 14, background: tab === k ? 'var(--navy)' : 'transparent', color: tab === k ? '#fff' : 'var(--gray)' }}>{l}</button>
        ))}
      </div>

      {adding && (
        <div className="cl-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 160 }}><span className="cl-label">{isBiz ? 'Business name' : 'Name'}</span><input className="cl-field" placeholder={isBiz ? 'Marina Bay Hotel' : 'Full name'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label style={{ flex: 1, minWidth: 180 }}><span className="cl-label">Email</span><input className="cl-field" placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label style={{ flex: 1, minWidth: 140 }}><span className="cl-label">Phone</span><input className="cl-field" placeholder="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
          {isBiz && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <label style={{ flex: 1, minWidth: 160 }}><span className="cl-label">Contact person</span><input className="cl-field" placeholder="e.g. Jane Lim (Ops)" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></label>
              <label style={{ flex: 2, minWidth: 220 }}><span className="cl-label">Billing address</span><input className="cl-field" placeholder="10 Bayfront Ave, Singapore 018956" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
              <label style={{ flex: 1, minWidth: 140 }}><span className="cl-label">GST / UEN</span><input className="cl-field" placeholder="20231234A" value={form.gst_no} onChange={(e) => setForm({ ...form, gst_no: e.target.value })} /></label>
              <label style={{ flex: 1, minWidth: 130 }}><span className="cl-label">Payment terms</span>
                <select className="cl-field" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
                  {['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on receipt'].map((t) => <option key={t}>{t}</option>)}
                </select></label>
            </div>
          )}
          <div className="cl-row" style={{ gap: 10, marginTop: 12 }}>
            <Button variant="lime" disabled={busy || !form.name.trim()} onClick={add}>{busy ? 'Adding…' : 'Save'}</Button>
            {err && <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{err}</span>}
          </div>
        </div>
      )}

      <input className="cl-field" placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14, maxWidth: 360 }} />

      <table className="ops-table">
        <thead><tr><th>{isBiz ? 'Business' : 'Customer'}</th><th>Contact</th>{isBiz ? <><th>Orders</th><th>Billed</th><th>Outstanding</th></> : <><th>Plan</th><th>Wallet</th><th>Orders</th></>}<th></th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><div className="cl-row" style={{ gap: 10 }}><Avatar name={c.name} size={32} />{c.name}</div></td>
              <td className="cl-muted" style={{ fontSize: 13 }}>{c.email || '—'}<br />{c.phone || ''}</td>
              {isBiz ? <>
                <td>{c.orders}</td><td>{fmt.money(c.billed_cents)}</td><td><b style={{ color: c.outstanding_cents ? 'var(--warn)' : 'var(--ok)' }}>{fmt.money(c.outstanding_cents)}</b></td>
              </> : <>
                <td><Chip variant="navy">{c.plan}</Chip></td><td>{fmt.money(c.balance_cents)}</td><td>{c.orders}</td>
              </>}
              <td style={{ textAlign: 'right' }}><Button sm variant="ghost" onClick={() => setSel(c)}>View</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <Empty icon="👥" title={`No ${isBiz ? 'businesses' : 'customers'} found`} />}

      {sel && <CustomerDrawer client={sel} isBiz={isBiz} onClose={() => setSel(null)} onInvoice={setInvoiceFor} />}
      {invoiceFor && <NewInvoiceModal client={invoiceFor} onClose={() => setInvoiceFor(null)} />}
    </>
  );
}

function CustomerDrawer({ client: initial, isBiz, onClose, onInvoice }) {
  const [client, setClient] = useState(initial);
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/api/customers/${client.id}/orders`).then(setOrders); }, [client.id]);

  const save = async () => {
    setBusy(true);
    const updated = await api.post(`/api/ops/clients/${client.id}`, form);
    setClient((c) => ({ ...c, ...updated })); setEditing(false); setBusy(false);
  };

  const detailRow = (label, val) => <div className="cl-between" style={{ padding: '4px 0', fontSize: 13 }}><span className="cl-muted">{label}</span><span style={{ fontWeight: 600, textAlign: 'right', maxWidth: 240 }}>{val || '—'}</span></div>;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="cl-between" style={{ marginBottom: 16 }}>
          <div className="cl-row" style={{ gap: 12 }}><Avatar name={client.name} size={44} /><div><div style={{ fontWeight: 900, fontSize: 20 }}>{client.name} {isBiz && <Chip variant="navy">B2B</Chip>}</div><div className="cl-muted" style={{ fontSize: 13 }}>{isBiz ? (client.payment_terms || 'Net 30') : `${client.plan} · wallet ${fmt.money(client.balance_cents)}`}</div></div></div>
          <button onClick={onClose} style={{ fontSize: 22 }}>✕</button>
        </div>

        <div className="cl-card" style={{ marginBottom: 14 }}>
          <div className="cl-between" style={{ marginBottom: editing ? 10 : 0 }}>
            <div className="cl-eyebrow">{isBiz ? 'Billing details' : 'Contact'}</div>
            {isBiz && <button onClick={() => { setForm(client); setEditing((x) => !x); }} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{editing ? 'Cancel' : '✏️ Edit'}</button>}
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['contact_person', 'Contact person'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Billing address'], ['gst_no', 'GST / UEN']].map(([k, l]) => (
                <label key={k}><span className="cl-label">{l}</span><input className="cl-field" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
              ))}
              <label><span className="cl-label">Payment terms</span>
                <select className="cl-field" value={form.payment_terms || 'Net 30'} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>{['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on receipt'].map((t) => <option key={t}>{t}</option>)}</select></label>
              <Button sm variant="lime" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save details'}</Button>
            </div>
          ) : isBiz ? (
            <>
              {detailRow('Contact', client.contact_person)}
              {detailRow('Email', client.email)}
              {detailRow('Phone', client.phone)}
              {detailRow('Address', client.address)}
              {detailRow('GST / UEN', client.gst_no)}
              {detailRow('Terms', client.payment_terms)}
            </>
          ) : (
            <div className="cl-muted" style={{ fontSize: 13 }}>{client.email || 'no email'} · {client.phone || 'no phone'}</div>
          )}
        </div>

        <div className="cl-between" style={{ marginBottom: 10 }}>
          <div className="cl-eyebrow">Orders ({orders.length})</div>
          <Button sm variant="lime" onClick={() => { onClose(); onInvoice(client); }}>🧾 New invoice</Button>
        </div>
        {orders.length === 0 ? <Empty icon="📦" title="No orders yet" /> : orders.map((o) => (
          <div key={o.id} className="cl-card" style={{ marginBottom: 8 }}>
            <div className="cl-between"><b>{o.code}</b><StatusPill status={o.status} label={o.status_label} /></div>
            <div className="cl-between" style={{ marginTop: 6 }}>
              <span className="cl-muted" style={{ fontSize: 13 }}>{fmt.date(o.created_at)} · {fmt.money(o.total_cents)} · {o.payment_status}</span>
              <Button sm variant="ghost" onClick={() => api.get(`/api/orders/${o.id}`).then(printInvoice)}>🧾 Invoice</Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// build an ad-hoc invoice (not tied to an order) and print it
function NewInvoiceModal({ client, onClose }) {
  const [catalog, setCatalog] = useState([]);
  const [rows, setRows] = useState([]); // { desc, qty, unit }  (unit in dollars)
  const [gst, setGst] = useState(true);
  const [discount, setDiscount] = useState(''); // dollars
  useEffect(() => { api.get('/api/catalog').then(setCatalog); }, []);

  const addCatalog = (cid) => { const c = catalog.find((x) => x.id === cid); if (c) setRows((r) => [...r, { desc: c.name, qty: 1, unit: (c.price_cents / 100).toFixed(2) }]); };
  const addCustom = () => setRows((r) => [...r, { desc: '', qty: 1, unit: '0.00' }]);
  const upd = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const del = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const lineCents = (r) => Math.round((parseFloat(r.qty) || 0) * (parseFloat(r.unit) || 0) * 100);
  const subtotal = rows.reduce((s, r) => s + lineCents(r), 0);
  const discountC = Math.round((parseFloat(discount) || 0) * 100);
  const taxable = Math.max(0, subtotal - discountC);
  const taxC = gst ? Math.round(taxable * 0.09) : 0;
  const total = taxable + taxC;

  const generate = () => {
    printInvoice({
      invoice_no: 'INV-' + (client.name || 'CL').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() + '-' + String(1000 + rows.length) + Math.abs(total % 1000),
      created_at: new Date().toISOString(),
      customer: { name: client.name, email: client.email, phone: client.phone, address: client.address, contact_person: client.contact_person, gst_no: client.gst_no, payment_terms: client.payment_terms },
      payment_terms: client.payment_terms || 'Net 30',
      items: rows.map((r) => ({ name: r.desc || 'Item', qty: parseFloat(r.qty) || 0, unit_cents: Math.round((parseFloat(r.unit) || 0) * 100), price_cents: lineCents(r) })),
      subtotal_cents: subtotal, discount_cents: discountC, tax_cents: taxC, platform_fee_cents: 0, delivery_fee_cents: 0, credit_applied_cents: 0,
      total_cents: total, payment_status: 'invoiced',
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,64,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="cl-card" style={{ width: 620, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="cl-between" style={{ marginBottom: 4 }}><b style={{ fontSize: 18 }}>New invoice</b><button onClick={onClose} style={{ fontSize: 20, color: 'var(--gray)' }}>✕</button></div>
        <div className="cl-muted" style={{ fontSize: 13, marginBottom: 14 }}>Bill to <b style={{ color: 'var(--navy)' }}>{client.name}</b>{client.payment_terms ? ` · ${client.payment_terms}` : ''}</div>

        {/* line items with editable prices */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 80px 28px', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--gray)', marginBottom: 6 }}>
          <span>Description</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Unit S$</span><span style={{ textAlign: 'right' }}>Amount</span><span />
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 80px 28px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input className="cl-field" value={r.desc} placeholder="Item description" onChange={(e) => upd(i, { desc: e.target.value })} />
            <input className="cl-field" style={{ textAlign: 'right' }} value={r.qty} onChange={(e) => upd(i, { qty: e.target.value })} />
            <input className="cl-field" style={{ textAlign: 'right' }} value={r.unit} onChange={(e) => upd(i, { unit: e.target.value })} />
            <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt.money(lineCents(r))}</span>
            <button onClick={() => del(i)} style={{ color: 'var(--danger)', fontSize: 16 }}>✕</button>
          </div>
        ))}
        {rows.length === 0 && <div className="cl-muted" style={{ fontSize: 13, padding: '6px 0' }}>No line items yet — add from the catalog or a custom line.</div>}

        <div className="cl-row" style={{ gap: 8, margin: '10px 0 14px' }}>
          <select className="cl-field" value="" onChange={(e) => { addCatalog(e.target.value); e.target.value = ''; }} style={{ maxWidth: 230 }}>
            <option value="">+ Add catalog item…</option>
            {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} · {fmt.money(c.price_cents)}</option>)}
          </select>
          <Button sm variant="ghost" onClick={addCustom}>+ Custom line</Button>
        </div>

        <div style={{ borderTop: '1px solid var(--gray3)', paddingTop: 12 }}>
          <div className="cl-between" style={{ marginBottom: 8 }}><span className="cl-muted">Subtotal</span><b>{fmt.money(subtotal)}</b></div>
          <div className="cl-between" style={{ marginBottom: 8 }}>
            <span className="cl-muted">Discount (S$)</span>
            <input className="cl-field" style={{ width: 100, textAlign: 'right' }} value={discount} placeholder="0.00" onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <label className="cl-between" style={{ marginBottom: 8, cursor: 'pointer' }}>
            <span className="cl-muted">Add GST (9%)</span>
            <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} />
          </label>
          {gst && <div className="cl-between" style={{ marginBottom: 8 }}><span className="cl-muted">GST</span><span>{fmt.money(taxC)}</span></div>}
          <div className="cl-between" style={{ fontWeight: 900, fontSize: 18, marginBottom: 14 }}><span>Total</span><span>{fmt.money(total)}</span></div>
        </div>

        <Button variant="lime" disabled={!rows.length} onClick={generate}>🧾 Generate PDF invoice</Button>
      </div>
    </div>
  );
}

function TagStation({ facilityId }) {
  const [orders, setOrders] = useState([]);
  const [selId, setSelId] = useState('');
  const [tags, setTags] = useState([]);
  const [qrMap, setQrMap] = useState({});
  const [scan, setScan] = useState('');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.get('/api/ops/orders' + qs(facilityId)).then(setOrders); }, [facilityId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const map = {};
      for (const g of tags) map[g.tag_code] = await QRCode.toDataURL(g.tag_code, { margin: 1, width: 220, color: { dark: '#1D2951', light: '#FFFFFF' } });
      if (alive) setQrMap(map);
    })();
    return () => { alive = false; };
  }, [tags]);

  const genTags = async (orderId) => {
    setSelId(orderId); setTags([]);
    if (!orderId) return;
    setTags(await api.post(`/api/orders/${orderId}/generate-tags`));
  };

  const doScan = async (e) => {
    e?.preventDefault();
    const code = scan.trim().toUpperCase(); if (!code) return;
    setErr('');
    try {
      const g = await api.post(`/api/garments/by-tag/${code}/advance`, { actor: 'scan' });
      setResult(g); setScan('');
    } catch { setErr(`Tag "${code}" not found.`); setResult(null); }
  };

  const printAll = () => {
    const stickers = tags.map((g) => `
      <div style="display:inline-flex;flex-direction:column;align-items:center;border:1.5px solid #1D2951;border-radius:12px;padding:14px;margin:8px;width:190px;font-family:-apple-system,sans-serif">
        <img src="${qrMap[g.tag_code] || ''}" width="150" height="150"/>
        <div style="font-weight:800;font-size:16px;margin-top:8px;color:#1D2951">${g.tag_code}</div>
        <div style="font-size:12px;color:#555">${g.type || ''}</div>
        <div style="font-size:10px;color:#999;margin-top:2px;letter-spacing:1px">CHASELAUNDRY</div>
      </div>`).join('');
    const w = window.open('', '_blank', 'width=720,height=800');
    w.document.write(`<html><head><title>Garment tags</title></head><body onload="window.print()" style="text-align:center">${stickers}</body></html>`);
    w.document.close();
  };

  const sel = orders.find((o) => o.id === selId);

  return (
    <>
      <div className="ops-h1">🏷️ Tag station</div>
      <p className="cl-muted" style={{ marginBottom: 18 }}>Print garment tags and scan them to advance each item through the wash.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' }}>
        {/* PRINT */}
        <div className="cl-card">
          <b>Print garment tags</b>
          <p className="cl-muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>Pick an order — we generate one QR tag per item.</p>
          <select className="cl-field" value={selId} onChange={(e) => genTags(e.target.value)} style={{ marginBottom: 14 }}>
            <option value="">— Select an order —</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.customer?.name || o.customer_name || ''} · {o.status_label || o.status}</option>)}
          </select>
          {sel && tags.length > 0 && <>
            <div className="cl-between" style={{ marginBottom: 12 }}>
              <span className="cl-muted" style={{ fontSize: 13 }}>{tags.length} tag{tags.length === 1 ? '' : 's'} for {sel.code}</span>
              <Button variant="lime" onClick={printAll}>🖨️ Print all</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {tags.map((g) => (
                <div key={g.id} style={{ width: 150, textAlign: 'center', border: '1.5px solid var(--gray3)', borderRadius: 12, padding: 12 }}>
                  {qrMap[g.tag_code] ? <img src={qrMap[g.tag_code]} width={118} height={118} alt={g.tag_code} /> : <div style={{ height: 118 }} />}
                  <div style={{ fontWeight: 800, marginTop: 6 }}>{g.tag_code}</div>
                  <div className="cl-muted" style={{ fontSize: 11 }}>{g.type}</div>
                  <Chip>{GARMENT_LABEL[g.status] || g.status}</Chip>
                </div>
              ))}
            </div>
          </>}
        </div>

        {/* SCAN */}
        <div className="cl-card">
          <b>Scan to update status</b>
          <p className="cl-muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>Scan a tag's QR (or type the code) to advance it to the next stage.</p>
          <form onSubmit={doScan} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input className="cl-field" autoFocus placeholder="e.g. CL-1042-01" value={scan} onChange={(e) => setScan(e.target.value)} />
            <Button variant="lime" onClick={doScan}>Scan</Button>
          </form>
          {err && <div style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10 }}>{err}</div>}
          {result && (
            <div style={{ background: 'var(--lime-pale)', borderRadius: 12, padding: 14 }}>
              <div className="cl-between" style={{ marginBottom: 8 }}>
                <b>{result.tag_code}</b>
                <Chip variant="navy">{GARMENT_LABEL[result.status] || result.status}</Chip>
              </div>
              <div className="cl-muted" style={{ fontSize: 12, marginBottom: 10 }}>✓ Advanced to <b>{GARMENT_LABEL[result.status] || result.status}</b></div>
              <GarmentJourney garment={result} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SupportInbox({ opsId }) {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState('customers'); // customers | factories
  
  const load = useCallback(() => api.get('/api/ops/threads').then(setThreads), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'support:message': load, 'thread:new': load }, { role: 'ops' }, []);

  const filteredThreads = threads.filter((t) => {
    if (tab === 'customers') return t.customer?.role === 'customer';
    return t.customer?.role === 'ops';
  });

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 18 }}>
        <div>
          <div className="ops-h1">Support Inbox</div>
          <p className="cl-muted">Customer & Factory conversations</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`cl-btn cl-btn-sm ${tab === 'customers' ? 'cl-btn-lime' : 'cl-btn-ghost'}`} onClick={() => { setTab('customers'); setActive(null); }}>
            👤 Customers
          </button>
          <button className={`cl-btn cl-btn-sm ${tab === 'factories' ? 'cl-btn-lime' : 'cl-btn-ghost'}`} onClick={() => { setTab('factories'); setActive(null); }}>
            🏭 Factories
          </button>
        </div>
      </div>
      <div className="ops-2col">
        <div>
          {filteredThreads.length === 0 ? <Empty icon="💬" title={`No ${tab} conversations`} /> :
            filteredThreads.map((t) => (
              <div key={t.id} className="cl-card" onClick={() => setActive(t.id)} style={{ marginBottom: 10, cursor: 'pointer', border: active === t.id ? '2px solid var(--navy)' : '2px solid transparent' }}>
                <div className="cl-between"><b>{t.customer?.name}</b><Chip variant={t.status === 'open' ? undefined : 'gray'}>{t.status}</Chip></div>
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{t.subject}</div>
                <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>{t.last?.body?.slice(0, 60) || '—'} · {fmt.ago(t.updated_at)}</div>
              </div>
            ))}
        </div>
        <OpsChat threadId={active} opsId={opsId} />
      </div>
    </>
  );
}

function OpsChat({ threadId, opsId }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const load = useCallback(() => { if (threadId) api.get(`/api/threads/${threadId}`).then(setThread); }, [threadId]);
  useEffect(() => { setThread(null); load(); }, [threadId, load]);
  useSocket({ 'support:message': (m) => { if (m.thread_id === threadId) load(); } }, { role: 'ops' }, [threadId]);
  useEffect(() => { if (threadId) getSocket().emit('watch:thread', threadId); }, [threadId]);
  const send = async () => { if (!text.trim()) return; await api.post(`/api/threads/${threadId}/messages`, { sender_role: 'ops', sender_id: opsId || 'ops_hq', body: text }); setText(''); load(); };

  if (!threadId) return <div className="cl-card"><Empty icon="👈" title="Select a conversation" /></div>;
  return (
    <div className="cl-card" style={{ display: 'flex', flexDirection: 'column', height: 560, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--gray3)', display: 'flex', alignItems: 'center' }} className="cl-between">
        <b>{thread?.subject}</b>
        <select
          className="ops-select"
          value={thread?.status || 'open'}
          onChange={async (e) => {
            const newStatus = e.target.value;
            await api.post(`/api/threads/${threadId}/status`, { status: newStatus });
            load();
          }}
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="not_an_issue">Not an issue</option>
        </select>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {thread?.messages?.map((m) => {
          if (m.sender_role === 'system') {
            return (
              <div key={m.id} style={{ alignSelf: 'center', margin: '6px 0', fontSize: 12, color: 'var(--gray)', fontStyle: 'italic', background: 'var(--gray3)', padding: '4px 10px', borderRadius: 8 }}>
                {m.body}
              </div>
            );
          }
          const mine = m.sender_id === (opsId || 'ops_hq');
          return <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div style={{ background: mine ? 'var(--navy)' : 'var(--light)', color: mine ? '#fff' : 'var(--text)', padding: '9px 13px', borderRadius: 12, fontSize: 14 }}>{m.body}</div>
            <div className="cl-muted" style={{ fontSize: 10, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>{mine ? 'You' : 'Other'} · {fmt.time(m.created_at)}</div>
          </div>;
        })}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--gray3)', display: 'flex', gap: 8 }}>
        <input className="cl-field" placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <Button sm variant="lime" onClick={send}>Send</Button>
      </div>
    </div>
  );
}

function FacilitySupport({ opsId }) {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);

  const load = useCallback(() => api.get(`/api/customers/${opsId}/threads`).then(setThreads), [opsId]);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'support:message': (m) => { if (threads.some((t) => t.id === m.thread_id)) load(); } }, { userId: opsId }, [threads, load]);

  const startNewThread = async () => {
    const subject = window.prompt("Enter a title/subject for the new support chat:");
    if (subject === null) return; // user cancelled
    const cleanSubject = subject.trim() || 'Urgent: Laundry Issue / Damaged items';
    const t = await api.post(`/api/customers/${opsId}/threads`, { subject: cleanSubject });
    load();
    setActive(t.id);
  };

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 18 }}>
        <div>
          <div className="ops-h1">Support Chats with HQ</div>
          <p className="cl-muted">Inform HQ support about damaged clothes, unable to wash, or adhoc order issues.</p>
        </div>
        <Button sm variant="lime" onClick={startNewThread}>+ New Chat with HQ</Button>
      </div>
      <div className="ops-2col">
        <div>
          {threads.length === 0 ? <Empty icon="💬" title="No chats started yet" sub="Start a chat to coordinate with HQ Support" /> :
            threads.map((t) => (
              <div key={t.id} className="cl-card" onClick={() => setActive(t.id)} style={{ marginBottom: 10, cursor: 'pointer', border: active === t.id ? '2px solid var(--navy)' : '2px solid transparent' }}>
                <div className="cl-between"><b>{t.subject}</b><Chip variant={t.status === 'open' ? undefined : 'gray'}>{t.status}</Chip></div>
                <div className="cl-muted" style={{ fontSize: 12, marginTop: 6 }}>Updated {fmt.ago(t.updated_at)}</div>
              </div>
            ))}
        </div>
        <OpsChat threadId={active} opsId={opsId} />
      </div>
    </>
  );
}

function InvoicingDashboard({ facilityId, isHQ }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [data, setData] = useState(null);
  const [selFacility, setSelFacility] = useState(null); // for viewing detail list of orders
  const [pricingFacility, setPricingFacility] = useState(null); // for onboard pricing modal
  const [pricingList, setPricingList] = useState([]); // pricing updates array
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    const res = await api.get(`/api/ops/invoices?month=${month}${facilityId ? `&facility_id=${facilityId}` : ''}`);
    setData(res);
  }, [month, facilityId]);

  useEffect(() => { load(); }, [load]);

  const openPricingModal = async (fac) => {
    setPricingFacility(fac);
    const list = await api.get(`/api/ops/pricing/${fac.facility_id}`);
    setPricingList(list);
  };

  const handlePricingChange = (catalogId, value) => {
    setPricingList((list) =>
      list.map((item) => (item.catalog_id === catalogId ? { ...item, cost_cents: Math.round(Number(value) * 100) } : item))
    );
  };

  const savePricing = async () => {
    setIsSavingPricing(true);
    await api.post(`/api/ops/pricing/${pricingFacility.facility_id}`, pricingList);
    setIsSavingPricing(false);
    setPricingFacility(null);
    load();
  };

  if (!data) return <Skel />;

  // Month options (e.g. last 6 months)
  const getMonths = () => {
    const list = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      list.push(date.toISOString().slice(0, 7));
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  };

  // Find selected facility in the invoicing summaries
  const detailsFac = data.summaries.find((s) => s.facility_id === selFacility);

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 18 }}>
        <div>
          <div className="ops-h1">{isHQ ? 'Factory Invoicing & Payouts' : 'My Revenue Invoices'}</div>
          <p className="cl-muted">
            {isHQ
              ? 'Calculate and generate factory revenue payouts based on completed orders'
              : 'Monthly breakdown of completed orders and revenue payouts'}
          </p>
        </div>
        <select className="ops-select" value={month} onChange={(e) => setMonth(e.target.value)}>
          {getMonths().map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {!selFacility ? (
        <div className="cl-card">
          <table className="ops-table" style={{ boxShadow: 'none' }}>
            <thead>
              <tr>
                <th>Factory Name</th>
                <th>Completed Orders</th>
                <th>Retail Revenue</th>
                <th>Payout Cost</th>
                {isHQ && <th>Net Margin</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.summaries.map((s) => (
                <tr key={s.facility_id}>
                  <td>
                    <b>{s.facility_name}</b> <span className="cl-muted">({s.facility_code})</span>
                  </td>
                  <td>{s.order_count}</td>
                  <td>{fmt.money(s.customer_revenue)}</td>
                  <td style={{ color: 'var(--navy)', fontWeight: 700 }}>{fmt.money(s.payout_cost)}</td>
                  {isHQ && (
                    <td style={{ color: s.margin >= 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 700 }}>
                      {fmt.money(s.margin)}
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button sm variant="ghost" onClick={() => setSelFacility(s.facility_id)}>
                        👁️ View Details
                      </Button>
                      {isHQ && (
                        <Button sm variant="lime" onClick={() => openPricingModal(s)}>
                          ⚙️ Configure Costs
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.summaries.length === 0 && <Empty icon="🧾" title="No invoice data for this month" />}
        </div>
      ) : (
        <div className="cl-card">
          <div className="cl-between" style={{ marginBottom: 16 }}>
            <div>
              <button onClick={() => setSelFacility(null)} style={{ fontSize: 16, marginRight: 10, fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--navy)' }}>
                ← Back
              </button>
              <b style={{ fontSize: 18 }}>{detailsFac?.facility_name} Detailed Report</b>
            </div>
            <Chip variant="navy">{month}</Chip>
          </div>

          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            <div className="cl-card" style={{ flex: 1, borderLeft: '4px solid var(--lime)' }}>
              <div className="cl-eyebrow">Orders Completed</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{detailsFac?.order_count}</div>
            </div>
            <div className="cl-card" style={{ flex: 1, borderLeft: '4px solid var(--navy)' }}>
              <div className="cl-eyebrow">Retail Subtotal</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{fmt.money(detailsFac?.customer_revenue)}</div>
            </div>
            <div className="cl-card" style={{ flex: 1, borderLeft: '4px solid var(--lime-d)' }}>
              <div className="cl-eyebrow">{isHQ ? 'Factory Payout Cost' : 'My Payout Revenue'}</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4, color: 'var(--lime-d)' }}>{fmt.money(detailsFac?.payout_cost)}</div>
            </div>
          </div>

          <table className="ops-table" style={{ boxShadow: 'none' }}>
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Customer</th>
                <th>Completed Date</th>
                <th>Retail Total</th>
                <th>Factory Cost</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {detailsFac?.orders.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.code}</b></td>
                  <td>{o.customer_name}</td>
                  <td>{fmt.date(o.created_at)}</td>
                  <td>{fmt.money(o.retail_total)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt.money(o.payout_total)}</td>
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--gray)' }}>
                      {o.items.map((it) => (
                        <div key={it.id}>
                          • {it.name}: {it.qty || it.weight_kg} {it.weight_kg ? 'kg' : 'pcs'} @ {fmt.money(it.cost_per_unit)} ({fmt.money(it.line_cost)})
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {detailsFac?.orders.length === 0 && <Empty icon="📦" title="No orders completed in this range" />}
        </div>
      )}

      {pricingFacility && (
        <>
          <div className="backdrop" onClick={() => setPricingFacility(null)} />
          <div className="drawer" style={{ width: 580 }}>
            <div className="cl-between" style={{ marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20 }}>Configure Factory Costs</div>
                <div className="cl-muted">{pricingFacility.facility_name} onboarding pricing</div>
              </div>
              <button onClick={() => setPricingFacility(null)} style={{ fontSize: 22 }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)', paddingRight: 10 }}>
              <p className="cl-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Set custom cost rates. Customers pay retail prices; the platform pays the cost configured below to this factory.
              </p>
              {pricingList.map((item) => (
                <div key={item.catalog_id} className="cl-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{item.icon} {item.name}</div>
                    <div className="cl-muted" style={{ fontSize: 12 }}>Retail: {fmt.money(item.retail_cents)} / {item.unit === 'per_kg' ? 'kg' : 'item'}</div>
                  </div>
                  <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>S$</span>
                    <input
                      className="cl-field"
                      type="number"
                      step="0.01"
                      value={+(item.cost_cents / 100).toFixed(2)}
                      onChange={(e) => handlePricingChange(item.catalog_id, e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setPricingFacility(null)}>Cancel</Button>
              <Button variant="lime" disabled={isSavingPricing} onClick={savePricing}>
                {isSavingPricing ? 'Saving…' : 'Save Pricing Config'}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Skel() { return <div className="ops-grid stat-grid">{[1, 2, 3, 4].map((i) => <div key={i} className="cl-skel" style={{ height: 110 }} />)}</div>; }
