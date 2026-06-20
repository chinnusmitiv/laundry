import React, { useEffect, useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  api, fmt, useSocket, getSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_FLOW, GARMENT_LABEL,
  Logo, Button, Chip, Avatar, StatusPill, Empty, OneMap, GarmentJourney,
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
      { key: 'facility', label: 'Facility', icon: '🏭' },
      { key: 'drivers', label: 'Drivers', icon: '🚚' },
      { key: 'support', label: 'Support', icon: '💬', badge: stats?.open_threads },
      { key: 'invoicing', label: 'Invoicing & Payouts', icon: '🧾' },
    ]
    : [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' },
      { key: 'orders', label: 'My orders', icon: '📦' },
      { key: 'facility', label: 'Facility', icon: '🏭' },
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

  const load = useCallback(async () => {
    setOrders(await api.get('/api/ops/orders' + qs(facilityId)));
    setDrivers(await api.get('/api/ops/drivers'));
  }, [facilityId]);
  useEffect(() => { load(); api.get('/api/facilities').then(setFacilities); }, [load]);
  useSocket({ 'order:updated': load, 'order:new': load }, { role: 'ops' }, [facilityId]);

  const assignDriver = async (orderId, driver_id) => { await api.post(`/api/orders/${orderId}/assign`, { driver_id }); load(); };
  const assignFacility = async (orderId, facility_id) => { await api.post(`/api/orders/${orderId}/assign-facility`, { facility_id }); load(); };
  const filtered = filter === 'all' ? orders : filter === 'active' ? orders.filter((o) => !['completed', 'cancelled'].includes(o.status)) : orders.filter((o) => o.status === filter);

  return (
    <>
      <div className="cl-between" style={{ marginBottom: 18 }}>
        <div>
          <div className="ops-h1">{isHQ ? 'Orders & routing' : 'My orders'}</div>
          <p className="cl-muted">{isHQ ? 'Route each order to a warehouse, then assign a driver' : 'Orders routed to your warehouse'}</p>
        </div>
        <select className="ops-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option><option value="active">Active</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <table className="ops-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Warehouse</th><th>Driver</th><th>Total</th><th>Pay</th></tr></thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id} className="click" onClick={() => setSel(o.id)}>
              <td style={{ fontWeight: 800 }}>{o.code}</td>
              <td>{o.customer?.name}</td>
              <td><StatusPill status={o.status} label={o.status_label} /></td>
              <td onClick={(e) => e.stopPropagation()}>
                {isHQ
                  ? <select className="ops-select" value={o.facility_id || ''} onChange={(e) => assignFacility(o.id, e.target.value)} style={!o.facility_id ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}>
                      <option value="">Route…</option>
                      {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
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
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <Empty icon="📦" title={isHQ ? 'No orders match' : 'Nothing routed to your warehouse yet'} />}
      {sel && <OrderDrawer orderId={sel} facilityId={facilityId} isHQ={isHQ} onClose={() => { setSel(null); load(); }} />}
    </>
  );
}

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
        </div>
      </div>

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
  const load = useCallback(() => api.get('/api/ops/drivers').then(setDrivers), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'driver:shift': load, 'driver:location': load, 'order:updated': load }, { role: 'ops' }, []);
  return (
    <>
      <div className="ops-h1">Drivers</div>
      <p className="cl-muted" style={{ marginBottom: 18 }}>Shift status and live workload</p>
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
