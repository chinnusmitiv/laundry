import React, { useEffect, useState, useCallback } from 'react';
import {
  api, fmt, getSocket, useSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_LABEL,
  Logo, Mark, Button, Card, Chip, Field, Avatar, StatusPill, TopBar, BottomNav, Sheet, Empty, OneMap, GarmentJourney, PlacesAutocomplete,
} from '@shared';

const CUSTOMER_ID = 'cus_1'; // demo session: Alex Morgan (on Plus)

export default function App() {
  const [tab, setTab] = useState('home');
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [openOrder, setOpenOrder] = useState(null); // order id
  const [flowOpen, setFlowOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const load = useCallback(async () => {
    const [s, o, n] = await Promise.all([
      api.get(`/api/customers/${CUSTOMER_ID}/summary`),
      api.get(`/api/customers/${CUSTOMER_ID}/orders`),
      api.get(`/api/customers/${CUSTOMER_ID}/notifications`),
    ]);
    setSummary(s); setOrders(o); setNotifs(n);
  }, []);

  useEffect(() => { load(); }, [load]);

  useSocket({
    'order:updated': () => load(),
    'notification': () => load(),
  }, { userId: CUSTOMER_ID, role: 'customer' }, []);

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="cl-phone">
      <TopBar
        left={<Logo size={20} theme="dark" />}
        right={
          <button onClick={() => setNotifOpen(true)} style={{ position: 'relative', color: '#fff', fontSize: 22 }}>
            🔔{unread > 0 && <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--lime)', color: 'var(--navy)', fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread}</span>}
          </button>
        }
      />

      <div className="cl-scroll">
        {tab === 'home' && <Home summary={summary} orders={orders} onOpenOrder={setOpenOrder} onOrder={() => setFlowOpen(true)} onTab={setTab} />}
        {tab === 'orders' && <Orders orders={orders} onOpenOrder={setOpenOrder} onOrder={() => setFlowOpen(true)} />}
        {tab === 'wallet' && <Wallet onReload={load} />}
        {tab === 'support' && <Support />}
        {tab === 'account' && <Account summary={summary} onReload={load} />}
      </div>

      <BottomNav
        active={tab} onChange={setTab}
        tabs={[
          { key: 'home', label: 'Home', icon: '🏠' },
          { key: 'orders', label: 'Orders', icon: '📦', badge: summary?.open_orders || 0 },
          { key: 'wallet', label: 'Wallet', icon: '💳' },
          { key: 'support', label: 'Support', icon: '💬' },
          { key: 'account', label: 'Account', icon: '👤' },
        ]}
      />

      <OrderFlow open={flowOpen} onClose={() => setFlowOpen(false)} onPlaced={(o) => { setFlowOpen(false); load(); setOpenOrder(o.id); }} summary={summary} />
      <OrderDetail orderId={openOrder} onClose={() => { setOpenOrder(null); load(); }} />
      <Notifications open={notifOpen} onClose={() => { setNotifOpen(false); load(); }} notifs={notifs} />
    </div>
  );
}

// ─────────────────────────────────────── HOME
function Home({ summary, orders, onOpenOrder, onOrder, onTab }) {
  if (!summary) return <Loading />;
  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  return (
    <div style={{ padding: 18 }}>
      <div style={{ marginBottom: 18 }}>
        <div className="cl-muted" style={{ fontSize: 14 }}>Good afternoon,</div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.5px' }}>{summary.user.name.split(' ')[0]} 👋</div>
      </div>

      {/* wallet + plan strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Card style={{ flex: 1, background: 'var(--navy)', color: '#fff' }}>
          <div className="cl-eyebrow" style={{ color: 'rgba(255,255,255,.4)' }}>Wallet</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{fmt.money(summary.balance_cents)}</div>
          <div style={{ fontSize: 11, color: 'var(--lime)', marginTop: 2 }}>credit available</div>
        </Card>
        <Card style={{ flex: 1, background: 'var(--lime)', color: 'var(--navy)' }}>
          <div className="cl-eyebrow" style={{ color: 'rgba(29,41,81,.45)' }}>Plan</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{summary.subscription?.plan_name || 'Lite'}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{summary.subscription ? `${summary.subscription.discount_pct}% off · free delivery` : 'pay as you go'}</div>
        </Card>
      </div>

      {/* primary CTA */}
      <Card style={{ background: 'linear-gradient(135deg,#162040,#253470)', color: '#fff', marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.3px' }}>More Life. Less Laundry.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 4, marginBottom: 16 }}>We collect, wash & return within 24h. You just relax can already. 😌</div>
        <Button variant="lime" onClick={onOrder}>Chiong, schedule a pickup →</Button>
      </Card>

      {/* active orders */}
      {active.length > 0 && <>
        <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Active orders</div>
        {active.map((o) => <OrderRow key={o.id} o={o} onClick={() => onOpenOrder(o.id)} />)}
      </>}

      {/* referral promo */}
      <Card style={{ marginTop: 16, border: '1.5px dashed var(--lime-d)', background: 'var(--lime-pale)' }} onClick={() => onTab('wallet')}>
        <div className="cl-between">
          <div>
            <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Give S$5, get S$5</div>
            <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>Invite your kaki → both get credit, win-win lah</div>
          </div>
          <span style={{ fontSize: 26 }}>🎁</span>
        </div>
      </Card>
    </div>
  );
}

function OrderRow({ o, onClick }) {
  return (
    <Card onClick={onClick} style={{ marginBottom: 10, cursor: 'pointer' }}>
      <div className="cl-between">
        <div>
          <div style={{ fontWeight: 800 }}>{o.code}</div>
          <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{o.items?.map((i) => i.name).join(' · ') || '—'}</div>
        </div>
        <StatusPill status={o.status} label={o.status_label} />
      </div>
    </Card>
  );
}

// ─────────────────────────────────────── ORDERS
function Orders({ orders, onOpenOrder, onOrder }) {
  return (
    <div style={{ padding: 18 }}>
      <div className="cl-between" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Your orders</div>
        <Button sm variant="lime" onClick={onOrder}>+ New</Button>
      </div>
      {orders.length === 0 ? <Empty icon="📦" title="No orders yet leh" sub="Schedule your first pickup, confirm shiok" /> :
        orders.map((o) => (
          <Card key={o.id} onClick={() => onOpenOrder(o.id)} style={{ marginBottom: 10, cursor: 'pointer' }}>
            <div className="cl-between">
              <div style={{ fontWeight: 800 }}>{o.code}</div>
              <StatusPill status={o.status} label={o.status_label} />
            </div>
            <div className="cl-between" style={{ marginTop: 8 }}>
              <span className="cl-muted" style={{ fontSize: 12 }}>{fmt.date(o.created_at)} · {o.items?.length || 0} item(s)</span>
              <span style={{ fontWeight: 800 }}>{fmt.money(o.total_cents)}</span>
            </div>
          </Card>
        ))}
    </div>
  );
}

// ─────────────────────────────────────── ORDER DETAIL (tracking)
function OrderDetail({ orderId, onClose }) {
  const [o, setO] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const reload = useCallback(() => { if (orderId) api.get(`/api/orders/${orderId}`).then(setO); }, [orderId]);
  useEffect(() => { setO(null); setDriverLoc(null); reload(); }, [orderId, reload]);

  useSocket({
    'order:updated': (u) => { if (u.id === orderId) setO(u); },
    'driver:location': (loc) => { if (loc.order_id === orderId) setDriverLoc(loc); },
  }, orderId ? { orderId } : null, [orderId]);

  useEffect(() => { if (orderId) getSocket().emit('watch:order', orderId); }, [orderId]);

  if (!orderId) return null;
  const showMap = o && ['driver_en_route', 'out_for_delivery'].includes(o.status) && o.address;
  const driver = driverLoc || o?.location;

  const simulate = async () => { await api.post(`/api/demo/orders/${orderId}/simulate-drive`, {}); };

  return (
    <Sheet open={!!orderId} onClose={onClose} title={o ? `${o.code}` : 'Loading…'}>
      {!o ? <Loading /> : <>
        <div className="cl-between" style={{ marginBottom: 14 }}>
          <StatusPill status={o.status} label={o.status_label} />
          <span style={{ fontWeight: 900 }}>{fmt.money(o.total_cents)} {o.payment_status === 'paid' ? <Chip>paid</Chip> : <Chip variant="gray">unpaid</Chip>}</span>
        </div>

        {showMap && <div style={{ marginBottom: 14 }}>
          <OneMap driver={driver} dest={o.address} />
          <div className="cl-between" style={{ marginTop: 8 }}>
            <span className="cl-muted" style={{ fontSize: 12 }}>{o.driver?.name} is on the way</span>
            <Button sm variant="ghost" onClick={simulate}>▶ Advance driver</Button>
          </div>
        </div>}

        {o.transfer
          ? <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--navy)', fontWeight: 700 }}>🚚 Moving to our {o.transfer.to?.name} for specialist care</div>
          : o.facility && <div className="cl-muted" style={{ fontSize: 12, marginBottom: 12 }}>🏭 Processed at {o.facility.name}, {o.facility.area}</div>}

        {o.notes && <Card style={{ marginBottom: 14, background: 'var(--lime-pale)', border: '1.5px dashed var(--lime-d)' }}>
          <div className="cl-eyebrow" style={{ color: 'var(--navy)' }}>Special Instructions / Garment Notes</div>
          <div style={{ fontSize: 13, color: 'var(--navy)', marginTop: 4, fontStyle: 'italic' }}>“{o.notes}”</div>
        </Card>}

        {/* status timeline */}
        <Card style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 12 }}>Progress</div>
          <Timeline status={o.status} />
        </Card>

        {/* garments tracking — tag + live journey */}
        {o.garments?.length > 0 && <Card style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Item tracking ({o.garments.length})</div>
          {o.garments.map((g) => <GarmentCard key={g.id} g={g} />)}
        </Card>}

        {/* pricing breakdown */}
        <Card style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Receipt</div>
          {o.items.map((i) => <Line key={i.id} l={i.name + (i.weight_kg ? ` (${i.weight_kg}kg)` : i.qty > 1 ? ` ×${i.qty}` : '')} v={fmt.money(i.price_cents)} />)}
          <div className="cl-divider" />
          <Line l="Subtotal" v={fmt.money(o.subtotal_cents)} />
          <Line l="Platform fee" v={fmt.money(o.platform_fee_cents)} />
          <Line l="Delivery" v={o.delivery_fee_cents ? fmt.money(o.delivery_fee_cents) : 'FREE'} />
          {o.discount_cents > 0 && <Line l="Plan discount" v={`– ${fmt.money(o.discount_cents)}`} green />}
          {o.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(o.credit_applied_cents)}`} green />}
          <div className="cl-divider" />
          <Line l={<b>Total</b>} v={<b>{fmt.money(o.total_cents)}</b>} />
        </Card>

        {o.payment_status !== 'paid' && o.status !== 'cancelled' &&
          <Button variant="lime" style={{ marginBottom: 10 }} onClick={async () => { await api.post(`/api/orders/${o.id}/pay`); reload(); }}>Pay {fmt.money(o.total_cents)}</Button>}

        {o.status === 'completed' && <Button variant="ghost" style={{ marginBottom: 10 }} onClick={() => setReviewOpen(true)}>★ Rate this order</Button>}

        <Button variant="ghost" onClick={onClose}>Close</Button>

        <ReviewSheet open={reviewOpen} onClose={() => setReviewOpen(false)} order={o} />
      </>}
    </Sheet>
  );
}

function GarmentCard({ g }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--gray3)' }}>
      <div className="cl-between" onClick={() => setOpen((x) => !x)} style={{ cursor: 'pointer' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.type} <span className="cl-muted" style={{ fontWeight: 400 }}>· {g.color}</span></div>
          <div className="cl-muted" style={{ fontSize: 11 }}>🏷️ {g.tag_code}{g.care ? ` · ${g.care}` : ''}</div>
        </div>
        <Chip variant={g.status === 'returned' || g.status === 'packed' ? 'navy' : undefined}>{GARMENT_LABEL[g.status] || g.status}</Chip>
      </div>
      <div style={{ marginTop: 10 }}>
        <GarmentJourney garment={g} compact={!open} />
      </div>
      {!open && <div onClick={() => setOpen(true)} style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 700, marginTop: 6, cursor: 'pointer' }}>View journey ↓</div>}
    </div>
  );
}

function Timeline({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  const visible = ['placed', 'driver_en_route', 'picked_up', 'processing', 'out_for_delivery', 'completed'];
  return (
    <div>
      {visible.map((s) => {
        const done = STATUS_FLOW.indexOf(s) <= idx;
        const current = s === status || (s === 'processing' && ['at_facility', 'ready'].includes(status)) || (s === 'completed' && status === 'delivered');
        return (
          <div key={s} className="cl-row" style={{ gap: 12, padding: '6px 0' }}>
            <div style={{ width: 22, height: 22, borderRadius: 22, flexShrink: 0, background: done ? 'var(--lime)' : 'var(--gray3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--navy)', fontWeight: 900 }}>{done ? '✓' : ''}</div>
            <span style={{ fontWeight: current ? 800 : 600, color: done ? 'var(--navy)' : 'var(--gray2)' }}>{STATUS_LABEL[s]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewSheet({ open, onClose, order }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const submit = async () => { await api.post(`/api/orders/${order.id}/review`, { rating, comment, google_linked: true }); setDone(true); };
  return (
    <Sheet open={open} onClose={onClose} title="Rate your order">
      {done ? <Empty icon="💚" title="Thanks ah, you the best!" sub="Your review helps us grow." /> : <>
        <div style={{ textAlign: 'center', fontSize: 38, marginBottom: 12 }}>
          {[1, 2, 3, 4, 5].map((n) => <span key={n} onClick={() => setRating(n)} style={{ cursor: 'pointer', opacity: n <= rating ? 1 : .25 }}>★</span>)}
        </div>
        <textarea className="cl-field" rows={3} placeholder="Tell us how we did…" value={comment} onChange={(e) => setComment(e.target.value)} style={{ marginBottom: 12 }} />
        <Button variant="lime" onClick={submit}>Submit review</Button>
      </>}
    </Sheet>
  );
}

// ─────────────────────────────────────── ORDER FLOW (create)
function OrderFlow({ open, onClose, onPlaced, summary }) {
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [cart, setCart] = useState({}); // catalogId -> {qty, weight}
  const [slot, setSlot] = useState('Today · 18:00–20:00');
  const [useCredit, setUseCredit] = useState(true);
  const [quote, setQuote] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      api.get('/api/catalog').then(setCatalog); setStep(1); setCart({}); setAdding(false); setNotes('');
      const addrs = summary?.addresses || [];
      setAddresses(addrs); setAddrId((addrs.find((a) => a.is_default) || addrs[0])?.id || null);
    }
  }, [open, summary]);

  const addPlace = async (p) => {
    const a = await api.post(`/api/customers/${summary.user.id}/addresses`, { label: p.name, line1: p.line1, line2: '', city: 'Singapore', postcode: p.postcode, lat: p.lat, lng: p.lng, make_default: true });
    setAddresses((list) => [...list, a]); setAddrId(a.id); setAdding(false);
  };

  const items = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0).map(([catalog_id, v]) => ({ catalog_id, qty: v.qty, weight_kg: v.weight }));

  useEffect(() => {
    if (step === 3 && items.length) api.post('/api/orders/quote', { customer_id: summary?.user.id, items, use_credit: useCredit }).then(setQuote);
    // eslint-disable-next-line
  }, [step, useCredit]);

  const place = async () => {
    setPlacing(true);
    const o = await api.post('/api/orders', {
      customer_id: summary.user.id, address_id: addrId, items,
      pickup_slot: slot, return_slot: 'Thu · 18:00–20:00', use_credit: useCredit, notes,
    });
    setPlacing(false); onPlaced(o);
  };

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  return (
    <Sheet open={open} onClose={onClose} title={`Schedule pickup · Step ${step}/3`}>
      {step === 1 && <>
        <p className="cl-muted" style={{ fontSize: 13, marginBottom: 14 }}>What needs cleaning?</p>
        {catalog.map((c) => {
          const v = cart[c.id] || {};
          return (
            <Card key={c.id} style={{ marginBottom: 10 }}>
              <div className="cl-between">
                <div className="cl-row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                    <div className="cl-muted" style={{ fontSize: 12 }}>{fmt.money(c.price_cents)} / {c.unit === 'per_kg' ? 'kg' : 'item'} · {c.eta_hours}h</div>
                  </div>
                </div>
                {c.unit === 'per_kg'
                  ? <Stepper value={v.weight || 0} step={0.5} unit="kg" onChange={(weight) => setItem(c.id, { weight })} />
                  : <Stepper value={v.qty || 0} step={1} onChange={(qty) => setItem(c.id, { qty })} />}
              </div>
            </Card>
          );
        })}
        <Button variant="lime" disabled={!items.length} onClick={() => setStep(2)} style={{ marginTop: 8 }}>Continue</Button>
      </>}

      {step === 2 && <>
        <p className="cl-muted" style={{ fontSize: 13, marginBottom: 14 }}>When should we collect?</p>
        {['Today · 18:00–20:00', 'Tomorrow · 08:00–10:00', 'Tomorrow · 18:00–20:00'].map((s) => (
          <Card key={s} onClick={() => setSlot(s)} style={{ marginBottom: 10, border: slot === s ? '2px solid var(--navy)' : '2px solid transparent', cursor: 'pointer' }}>
            <div className="cl-between"><span style={{ fontWeight: 700 }}>{s}</span>{slot === s && <span>✓</span>}</div>
          </Card>
        ))}
        <div className="cl-between" style={{ margin: '16px 0 8px' }}>
          <div className="cl-eyebrow">Pickup address</div>
          <span onClick={() => setAdding((x) => !x)} style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>{adding ? 'Cancel' : '+ Add'}</span>
        </div>
        {adding && <div style={{ marginBottom: 10 }}><PlacesAutocomplete autoFocus onSelect={addPlace} placeholder="Tiong Bahru, 168732, ION Orchard…" /></div>}
        {addresses.map((a) => (
          <Card key={a.id} onClick={() => setAddrId(a.id)} style={{ marginBottom: 10, border: addrId === a.id ? '2px solid var(--navy)' : '2px solid transparent', cursor: 'pointer' }}>
            <div className="cl-between"><div><div style={{ fontWeight: 700 }}>{a.label}</div><div className="cl-muted" style={{ fontSize: 13 }}>{a.line1}, {a.postcode}</div></div>{addrId === a.id && <span>✓</span>}</div>
          </Card>
        ))}
        <div className="cl-eyebrow" style={{ margin: '16px 0 8px' }}>Special Instructions / Garment Notes</div>
        <textarea className="cl-field" rows={3} placeholder="E.g., 2 Oxford shirts (White/Blue), tumble dry low for chinos..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
          <Button variant="lime" disabled={!addrId} onClick={() => setStep(3)}>Review</Button>
        </div>
      </>}

      {step === 3 && <>
        {!quote ? <Loading /> : <>
          <Card style={{ marginBottom: 14 }}>
            <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Order summary</div>
            <Line l="Subtotal" v={fmt.money(quote.subtotal_cents)} />
            <Line l="Platform fee" v={fmt.money(quote.platform_fee_cents)} />
            <Line l="Delivery" v={quote.delivery_fee_cents ? fmt.money(quote.delivery_fee_cents) : 'FREE'} />
            {quote.discount_cents > 0 && <Line l={`${summary?.subscription?.plan_name} discount`} v={`– ${fmt.money(quote.discount_cents)}`} green />}
            {quote.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(quote.credit_applied_cents)}`} green />}
            <div className="cl-divider" />
            <Line l={<b>Total today</b>} v={<b>{fmt.money(quote.total_cents)}</b>} />
          </Card>
          <Card style={{ marginBottom: 14 }} onClick={() => setUseCredit((x) => !x)}>
            <div className="cl-between"><span style={{ fontWeight: 700 }}>Use wallet credit ({fmt.money(summary?.balance_cents)})</span>
              <span style={{ width: 44, height: 26, borderRadius: 999, background: useCredit ? 'var(--lime)' : 'var(--gray3)', position: 'relative', transition: '.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: useCredit ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff', transition: '.2s' }} /></span>
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button variant="lime" disabled={placing} onClick={place}>{placing ? 'Placing…' : 'Place order'}</Button>
          </div>
        </>}
      </>}
    </Sheet>
  );
}

function Stepper({ value, step, unit, onChange }) {
  return (
    <div className="cl-row" style={{ gap: 10 }}>
      <button onClick={() => onChange(Math.max(0, +(value - step).toFixed(1)))} style={btnCircle}>−</button>
      <span style={{ minWidth: 44, textAlign: 'center', fontWeight: 800 }}>{value || 0}{unit && value ? unit : ''}</span>
      <button onClick={() => onChange(+(value + step).toFixed(1))} style={{ ...btnCircle, background: 'var(--navy)', color: '#fff' }}>+</button>
    </div>
  );
}
const btnCircle = { width: 32, height: 32, borderRadius: 32, background: 'var(--gray3)', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)' };

// ─────────────────────────────────────── WALLET
function Wallet({ onReload }) {
  const [data, setData] = useState(null);
  const [ref, setRef] = useState(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.get(`/api/customers/${CUSTOMER_ID}/credits`).then(setData);
    api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef);
  }, []);

  const invite = async () => { await api.post(`/api/customers/${CUSTOMER_ID}/referrals`, { email }); setSent(true); setEmail(''); api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef); };

  if (!data) return <Loading />;
  const typeIcon = { referral: '🎁', in_store: '💚', signup: '👋', refund: '↩️', spend: '🧾', adjustment: '⚙️' };
  return (
    <div style={{ padding: 18 }}>
      <Card style={{ background: 'var(--navy)', color: '#fff', marginBottom: 16, textAlign: 'center' }}>
        <div className="cl-eyebrow" style={{ color: 'rgba(255,255,255,.4)' }}>Wallet balance</div>
        <div style={{ fontSize: 40, fontWeight: 900, margin: '8px 0' }}>{fmt.money(data.balance_cents)}</div>
        <div style={{ fontSize: 12, color: 'var(--lime)' }}>Applied automatically at checkout</div>
      </Card>

      {/* referral */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 4 }}>Refer a friend 🎁</div>
        <div className="cl-muted" style={{ fontSize: 13, marginBottom: 12 }}>You both get {fmt.money(ref?.reward_cents || 500)} when they place their first order.</div>
        <div className="cl-between" style={{ background: 'var(--lime-pale)', padding: '12px 14px', borderRadius: 12, marginBottom: 12 }}>
          <span style={{ fontWeight: 900, letterSpacing: '1px', color: 'var(--navy)' }}>{ref?.code}</span>
          <span className="cl-chip">your code</span>
        </div>
        <div className="cl-row" style={{ gap: 8 }}>
          <input className="cl-field" placeholder="friend@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button sm variant="lime" disabled={!email} onClick={invite} style={{ whiteSpace: 'nowrap' }}>Invite</Button>
        </div>
        {sent && <div style={{ color: 'var(--ok)', fontSize: 12, marginTop: 8, fontWeight: 700 }}>✓ Invite sent</div>}
        {ref?.referrals?.length > 0 && <div style={{ marginTop: 12 }}>
          {ref.referrals.map((r) => <div key={r.id} className="cl-between" style={{ fontSize: 13, padding: '6px 0' }}><span className="cl-muted">{r.referee_email}</span><Chip variant={r.status === 'rewarded' ? 'navy' : 'gray'}>{r.status}</Chip></div>)}
        </div>}
      </Card>

      {/* ledger */}
      <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Credit history</div>
      <Card>
        {data.ledger.map((l) => (
          <div key={l.id} className="cl-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--gray3)' }}>
            <div className="cl-row" style={{ gap: 10 }}>
              <span style={{ fontSize: 18 }}>{typeIcon[l.type] || '•'}</span>
              <div><div style={{ fontWeight: 700, fontSize: 14 }}>{l.reason}</div><div className="cl-muted" style={{ fontSize: 11 }}>{fmt.ago(l.created_at)}</div></div>
            </div>
            <span style={{ fontWeight: 800, color: l.amount_cents < 0 ? 'var(--gray)' : 'var(--ok)' }}>{l.amount_cents < 0 ? '' : '+'}{fmt.money(l.amount_cents)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────── SUPPORT
// ─────────────────────────────────────── SUPPORT
function Support() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);

  const load = () => api.get(`/api/customers/${CUSTOMER_ID}/threads`).then(setThreads);
  useEffect(() => { load(); }, []);

  const startNewChat = async () => {
    const subject = window.prompt("Enter a title/subject for the new support chat:");
    if (subject === null) return; // user cancelled
    const cleanSubject = subject.trim() || 'New conversation';
    const t = await api.post(`/api/customers/${CUSTOMER_ID}/threads`, { subject: cleanSubject });
    load();
    setActive(t.id);
  };

  if (active) return <Chat threadId={active} onBack={() => { setActive(null); load(); }} />;
  return (
    <div style={{ padding: 18 }}>
      <div className="cl-between" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Support</div>
        <Button sm variant="lime" onClick={startNewChat}>+ New chat</Button>
      </div>
      <Card style={{ marginBottom: 14, background: 'var(--lime-pale)' }}>
        <div className="cl-row" style={{ gap: 10 }}><span style={{ fontSize: 22 }}>💬</span><div><div style={{ fontWeight: 800 }}>We reply fast one</div><div className="cl-muted" style={{ fontSize: 12 }}>Real humans, 7am–11pm daily. Just ask ah!</div></div></div>
      </Card>
      {threads.length === 0 ? <Empty icon="💬" title="No chats yet" sub="Got problem? Just message us lah" /> :
        threads.map((t) => (
          <Card key={t.id} onClick={() => setActive(t.id)} style={{ marginBottom: 10, cursor: 'pointer' }}>
            <div className="cl-between"><span style={{ fontWeight: 800 }}>{t.subject}</span><Chip variant={t.status === 'open' ? undefined : 'gray'}>{t.status.replace('_', ' ')}</Chip></div>
            <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>Updated {fmt.ago(t.updated_at)}</div>
          </Card>
        ))}
    </div>
  );
}

function Chat({ threadId, onBack }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');

  const load = useCallback(() => api.get(`/api/threads/${threadId}`).then(setThread), [threadId]);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'support:message': (m) => { if (m.thread_id === threadId) load(); } }, { userId: CUSTOMER_ID }, [threadId]);
  useEffect(() => { getSocket().emit('watch:thread', threadId); }, [threadId]);

  const send = async () => { if (!text.trim()) return; await api.post(`/api/threads/${threadId}/messages`, { sender_role: 'customer', sender_id: CUSTOMER_ID, body: text }); setText(''); load(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray3)', background: '#fff', display: 'flex', alignItems: 'center' }} className="cl-between">
        <div className="cl-row">
          <button onClick={onBack} style={{ fontSize: 20, marginRight: 12 }}>←</button>
          <div><div style={{ fontWeight: 800 }}>{thread?.subject || 'Support'}</div><div className="cl-muted" style={{ fontSize: 11 }}>ChaseLaundry Support</div></div>
        </div>
        {thread?.status && (
          <Chip variant={thread.status === 'open' ? undefined : 'gray'}>
            {thread.status.replace('_', ' ')}
          </Chip>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {thread?.messages?.map((m) => {
          if (m.sender_role === 'system') {
            return (
              <div key={m.id} style={{ alignSelf: 'center', margin: '6px 0', fontSize: 12, color: 'var(--gray)', fontStyle: 'italic', background: 'var(--gray3)', padding: '4px 10px', borderRadius: 8 }}>
                {m.body}
              </div>
            );
          }
          const mine = m.sender_role === 'customer';
          return <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
            <div style={{ background: mine ? 'var(--navy)' : '#fff', color: mine ? '#fff' : 'var(--text)', padding: '10px 14px', borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4, boxShadow: 'var(--shadow-sm)', fontSize: 14 }}>{m.body}</div>
            <div className="cl-muted" style={{ fontSize: 10, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>{m.sender_role === 'ops' ? 'Support' : 'You'} · {fmt.time(m.created_at)}</div>
          </div>;
        })}
      </div>
      <div style={{ padding: 14, borderTop: '1px solid var(--gray3)', background: '#fff', display: 'flex', gap: 8 }}>
        <input className="cl-field" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <Button sm variant="lime" onClick={send}>Send</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────── ACCOUNT (profile + subscriptions)
function Account({ summary, onReload }) {
  const [plans, setPlans] = useState([]);
  useEffect(() => { api.get('/api/plans').then(setPlans); }, []);
  if (!summary) return <Loading />;
  const current = summary.subscription?.plan_id || 'plan_lite';

  const choose = async (plan_id) => { await api.post(`/api/customers/${CUSTOMER_ID}/subscription`, { plan_id }); onReload(); };

  return (
    <div style={{ padding: 18 }}>
      <Card style={{ marginBottom: 16 }}>
        <div className="cl-row" style={{ gap: 14 }}>
          <Avatar name={summary.user.name} size={52} />
          <div><div style={{ fontWeight: 900, fontSize: 18 }}>{summary.user.name}</div><div className="cl-muted" style={{ fontSize: 13 }}>{summary.user.email}</div></div>
        </div>
      </Card>

      <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Subscription</div>
      {plans.map((p) => {
        const active = p.id === current;
        return (
          <Card key={p.id} style={{ marginBottom: 12, border: active ? '2px solid var(--navy)' : '2px solid transparent' }}>
            <div className="cl-between">
              <div><span style={{ fontWeight: 900, fontSize: 17 }}>{p.name}</span> {active && <Chip variant="navy">current</Chip>}</div>
              <div style={{ fontWeight: 900 }}>{p.price_cents ? `${fmt.money(p.price_cents)}/mo` : 'Free'}</div>
            </div>
            <ul style={{ listStyle: 'none', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.perks.map((perk, i) => <li key={i} className="cl-row" style={{ gap: 8, fontSize: 13, color: 'var(--gray)' }}><span style={{ color: 'var(--lime-d)' }}>✓</span>{perk}</li>)}
            </ul>
            {!active && <Button sm variant={p.id === 'plan_lite' ? 'ghost' : 'lime'} onClick={() => choose(p.id)}>{p.id === 'plan_lite' ? 'Downgrade to Lite' : `Switch to ${p.name}`}</Button>}
          </Card>
        );
      })}

      <div className="cl-eyebrow" style={{ margin: '16px 0 10px' }}>Addresses</div>
      {summary.addresses.map((a) => (
        <Card key={a.id} style={{ marginBottom: 10 }}><div style={{ fontWeight: 700 }}>{a.label} {a.is_default ? <Chip variant="gray">default</Chip> : null}</div><div className="cl-muted" style={{ fontSize: 13 }}>{a.line1}, {a.city} {a.postcode}</div></Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────── NOTIFICATIONS
function Notifications({ open, onClose, notifs }) {
  useEffect(() => { if (open) api.post(`/api/customers/${CUSTOMER_ID}/notifications/read-all`); }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      {notifs.length === 0 ? <Empty icon="🔔" title="All clear, nothing for now lah" /> :
        notifs.map((n) => (
          <Card key={n.id} style={{ marginBottom: 10, opacity: n.read ? .7 : 1 }}>
            <div className="cl-between"><span style={{ fontWeight: 800 }}>{n.title}</span><span className="cl-muted" style={{ fontSize: 11 }}>{fmt.ago(n.created_at)}</span></div>
            <div className="cl-muted" style={{ fontSize: 13, marginTop: 4 }}>{n.body}</div>
          </Card>
        ))}
    </Sheet>
  );
}

// ─────────────────────────────────────── shared bits
function Line({ l, v, green }) {
  return <div className="cl-between" style={{ padding: '4px 0', fontSize: 14 }}><span className="cl-muted">{l}</span><span style={{ color: green ? 'var(--ok)' : 'inherit', fontWeight: green ? 700 : 500 }}>{v}</span></div>;
}
function Loading() { return <div style={{ padding: 18 }}>{[1, 2, 3].map((i) => <div key={i} className="cl-skel" style={{ height: 70, marginBottom: 12 }} />)}</div>; }
