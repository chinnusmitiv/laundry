import React, { useEffect, useState, useCallback } from 'react';
import {
  api, fmt, getSocket, useSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_LABEL, HANDOVER, ADDRESS_TYPES, TICKET_CATEGORIES, REPEAT_CADENCE, nextRepeatDue,
  Logo, Mark, Button, Card, Chip, Field, Avatar, StatusPill, TopBar, BottomNav, Sheet, Empty, OneMap, GarmentJourney, PlacesAutocomplete,
  PaymentSheet, TopUpSheet, topupBonus, distKm, printInvoice,
} from '@shared';

// ─────────────────────────────────────── AUTH SESSION
const AUTH_KEY = 'cl_customer_auth';
function loadAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
function saveAuth(user) { localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
function logout() { localStorage.removeItem(AUTH_KEY); location.reload(); }

// the signed-in customer id, used throughout the app (set on login / page load)
let CUSTOMER_ID = loadAuth()?.id || null;

export default function App() {
  const [auth, setAuth] = useState(loadAuth);
  if (!auth) {
    return <AuthScreen onAuth={(user) => { CUSTOMER_ID = user.id; saveAuth(user); setAuth(user); }} />;
  }
  CUSTOMER_ID = auth.id;
  return <CustomerApp />;
}

function CustomerApp() {
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

// ─────────────────────────────────────── AUTH (passwordless · email/phone + OTP)
function AuthScreen({ onAuth }) {
  const [step, setStep] = useState('identify'); // identify | verify
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(null); // { sent_to, is_new }
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const requestOtp = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/api/auth/request-otp', { identifier });
      setSent(res); setCode(''); setName(''); setStep('verify');
    } catch (e) { setErr(e.message || 'Could not send code. Try again.'); }
    finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setErr(''); setBusy(true);
    try {
      const { user } = await api.post('/api/auth/verify-otp', { identifier, code, name });
      onAuth(user);
    } catch (e) { setErr(e.message || 'Could not verify code. Try again.'); }
    finally { setBusy(false); }
  };

  const reset = () => { setStep('identify'); setCode(''); setErr(''); setSent(null); };

  return (
    <div className="cl-phone" style={{ background: 'var(--navy)' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Logo size={30} theme="dark" tagline />
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 14, marginBottom: 26 }}>
          {step === 'identify' ? 'Sign in or create your account' : 'Enter the code to continue'}
        </div>

        <div className="cl-card" style={{ padding: 20 }}>
          {step === 'identify' ? <>
            <Field label="Email address" type="email" autoComplete="username"
              placeholder="you@email.com" value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && identifier.trim() && requestOtp()} />

            {err && <ErrBox>{err}</ErrBox>}

            <Button variant="lime" disabled={!identifier.trim() || busy} onClick={requestOtp}>
              {busy ? 'Sending code…' : 'Send code'}
            </Button>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray)', marginTop: 12 }}>
              No password needed — we'll email you a one-time code.
            </div>
          </> : <>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 14 }}>
              We sent a 6-digit code to <b style={{ color: 'var(--navy)' }}>{sent?.sent_to}</b>.
            </div>

            {sent?.dev_code && (
              <div style={{ background: 'rgba(199,255,51,.15)', color: 'var(--navy)', fontSize: 13, fontWeight: 700, padding: '10px 12px', borderRadius: 10, marginBottom: 14, textAlign: 'center' }}>
                Demo mode — your code is <b style={{ letterSpacing: '2px' }}>{sent.dev_code}</b>
              </div>
            )}

            {sent?.is_new && (
              <Field label="Your name" placeholder="e.g. Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} />
            )}

            <label style={{ display: 'block', marginBottom: 14 }}>
              <span className="cl-label">6-digit code</span>
              <input className="cl-field" inputMode="numeric" maxLength={6} placeholder="••••••"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verifyOtp()}
                style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, letterSpacing: '10px' }} />
            </label>

            {err && <ErrBox>{err}</ErrBox>}

            <Button variant="lime" disabled={code.length !== 6 || (sent?.is_new && !name.trim()) || busy} onClick={verifyOtp}>
              {busy ? 'Verifying…' : sent?.is_new ? 'Create account' : 'Sign in'}
            </Button>
            <div className="cl-between" style={{ marginTop: 14, fontSize: 13 }}>
              <button onClick={reset} style={{ color: 'var(--gray)', fontWeight: 600 }}>← Change</button>
              <button onClick={requestOtp} disabled={busy} style={{ color: 'var(--navy)', fontWeight: 700 }}>Resend code</button>
            </div>

            {sent?.is_new && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray)', marginTop: 14 }}>
                🎁 New accounts get <b>S$10</b> welcome credit
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

function ErrBox({ children }) {
  return <div style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 12 }}>{children}</div>;
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
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{summary.subscription ? 'No service fee · free delivery' : 'pay as you go'}</div>
        </Card>
      </div>

      {/* primary CTA */}
      <Card style={{ background: 'linear-gradient(135deg,#162040,#253470)', color: '#fff', marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.3px' }}>More Life. Less Laundry.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 4, marginBottom: 16 }}>We collect, wash & return within 24h. You just relax can already. 😌</div>
        <Button variant="lime" onClick={onOrder}>Chiong, schedule a pickup →</Button>
      </Card>

      {/* demo: spawn a live-tracking order */}
      <Card onClick={async () => { const o = await api.post(`/api/demo/customers/${CUSTOMER_ID}/spawn-tracking`); onOpenOrder(o.id); }}
        style={{ marginBottom: 16, border: '1.5px dashed var(--navy)', cursor: 'pointer' }}>
        <div className="cl-between">
          <div><div style={{ fontWeight: 900 }}>🚗 Track a live driver</div><div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>Demo: spawn an out-for-delivery order & watch it move</div></div>
          <span style={{ fontSize: 22 }}>→</span>
        </div>
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
  const due = orders[0] && nextRepeatDue(orders[0]);
  const dueNow = due && due <= new Date();
  return (
    <div style={{ padding: 18 }}>
      <div className="cl-between" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Your orders</div>
        <Button sm variant="lime" onClick={onOrder}>+ New</Button>
      </div>
      {dueNow && (
        <Card style={{ marginBottom: 14, background: 'var(--navy)', color: '#fff' }} onClick={onOrder}>
          <div className="cl-between">
            <div><b>🔁 Time for your {REPEAT_CADENCE[orders[0].repeat_cadence]?.label.toLowerCase() || 'repeat'} order</b><div className="cl-muted" style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Same as last time — schedule your next pickup?</div></div>
            <Button sm variant="lime" onClick={onOrder}>Schedule</Button>
          </div>
        </Card>
      )}
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
  const [payOpen, setPayOpen] = useState(false);
  const [autoDrive, setAutoDrive] = useState(true);

  const reload = useCallback(() => { if (orderId) api.get(`/api/orders/${orderId}`).then(setO); }, [orderId]);
  useEffect(() => { setO(null); setDriverLoc(null); reload(); }, [orderId, reload]);

  useSocket({
    'order:updated': (u) => { if (u.id === orderId) setO(u); },
    'driver:location': (loc) => { if (loc.order_id === orderId) setDriverLoc(loc); },
  }, orderId ? { orderId } : null, [orderId]);

  useEffect(() => { if (orderId) getSocket().emit('watch:order', orderId); }, [orderId]);

  // live tracking: auto-advance the driver toward the address while en route
  const enRoute = o && ['driver_en_route', 'out_for_delivery'].includes(o.status) && o.address;
  useEffect(() => {
    if (!orderId || !autoDrive || !enRoute) return;
    const t = setInterval(() => { api.post(`/api/demo/orders/${orderId}/simulate-drive`, {}).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [orderId, autoDrive, enRoute]);

  if (!orderId) return null;
  const showMap = enRoute;
  const driver = driverLoc || o?.location;
  const km = driver?.lat && o?.address?.lat ? distKm(driver, o.address) : null;
  const etaMin = km != null ? Math.max(1, Math.round(km * 3)) : null;

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
          <div className="cl-between" style={{ marginTop: 10 }}>
            <span className="cl-row" style={{ gap: 7, fontSize: 13 }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, background: 'var(--ok)', boxShadow: '0 0 0 0 rgba(22,163,74,.5)', animation: 'clLive 1.6s infinite' }} />
              <b>{o.driver?.name?.split(' ')[0] || 'Driver'}</b>
              <span className="cl-muted">{km != null ? `· ${km.toFixed(1)} km away` : '· on the way'}</span>
            </span>
            {etaMin != null && <span style={{ fontWeight: 900, fontSize: 14 }}>~{etaMin} min</span>}
          </div>
          <div className="cl-row" style={{ gap: 8, marginTop: 10 }}>
            <Button sm variant="ghost" onClick={() => setAutoDrive((a) => !a)} style={{ flex: 1 }}>{autoDrive ? '⏸ Pause live' : '▶ Resume live'}</Button>
            <Button sm variant="ghost" onClick={simulate} style={{ flex: 1 }}>Advance ›</Button>
          </div>
          <style>{`@keyframes clLive{0%{box-shadow:0 0 0 0 rgba(22,163,74,.5)}70%{box-shadow:0 0 0 8px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}`}</style>
        </div>}

        {o.transfer
          ? <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--navy)', fontWeight: 700 }}>🚚 Moving to our {o.transfer.to?.name} for specialist care</div>
          : o.facility && <div className="cl-muted" style={{ fontSize: 12, marginBottom: 12 }}>🏭 Processed at {o.facility.name}, {o.facility.area}</div>}

        {o.handover && HANDOVER[o.handover] && <Card style={{ marginBottom: 14 }}>
          <div className="cl-row" style={{ gap: 12 }}>
            <span style={{ fontSize: 20 }}>{HANDOVER[o.handover].icon}</span>
            <div><div className="cl-eyebrow">Pickup</div><div style={{ fontWeight: 700, fontSize: 14 }}>{HANDOVER[o.handover].label}</div>
            {o.handover_contact && <div className="cl-muted" style={{ fontSize: 12 }}>{o.handover_contact}</div>}</div>
          </div>
        </Card>}

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
          <Line l="Service fee" v={o.platform_fee_cents ? fmt.money(o.platform_fee_cents) : 'WAIVED'} />
          <Line l="Delivery" v={o.delivery_fee_cents ? fmt.money(o.delivery_fee_cents) : 'FREE'} />
          {o.discount_cents > 0 && <Line l="Plan discount" v={`– ${fmt.money(o.discount_cents)}`} green />}
          {o.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(o.credit_applied_cents)}`} green />}
          <div className="cl-divider" />
          <Line l={<b>Total</b>} v={<b>{fmt.money(o.total_cents)}</b>} />
        </Card>

        {o.payment_status !== 'paid' && o.status !== 'cancelled' &&
          <Button variant="lime" style={{ marginBottom: 10 }} onClick={() => setPayOpen(true)}>Pay {fmt.money(o.total_cents)}</Button>}

        <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} amountCents={o.total_cents}
          title="Complete payment" description={o.code}
          onAuthorized={async () => { await api.post(`/api/orders/${o.id}/pay`); reload(); }} />

        {o.status === 'completed' && <Button variant="ghost" style={{ marginBottom: 10 }} onClick={() => setReviewOpen(true)}>★ Rate this order</Button>}

        <Button variant="ghost" style={{ marginBottom: 10 }} onClick={() => printInvoice(o)}>🧾 Download invoice</Button>
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
  const [handover, setHandover] = useState('hand_to_me');
  const [handoverContact, setHandoverContact] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [repeatCadence, setRepeatCadence] = useState('weekly');

  useEffect(() => {
    if (open) {
      api.get('/api/catalog').then(setCatalog); setStep(1); setCart({}); setAdding(false); setNotes(''); setHandover('hand_to_me'); setHandoverContact(''); setRepeat(false); setRepeatCadence('weekly');
      const addrs = summary?.addresses || [];
      setAddresses(addrs); setAddrId((addrs.find((a) => a.is_default) || addrs[0])?.id || null);
    }
  }, [open, summary]);

  const onAddrSaved = (a) => { setAddresses((list) => [...list, a]); setAddrId(a.id); setAdding(false); };

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
      handover, handover_contact: handover === 'someone_else' ? handoverContact : null,
      repeat_requested: repeat, repeat_cadence: repeat ? repeatCadence : null,
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
        {adding && <AddAddress customerId={summary.user.id} onSaved={onAddrSaved} onCancel={() => setAdding(false)} />}
        {addresses.map((a) => (
          <Card key={a.id} onClick={() => setAddrId(a.id)} style={{ marginBottom: 10, border: addrId === a.id ? '2px solid var(--navy)' : '2px solid transparent', cursor: 'pointer' }}>
            <div className="cl-between"><div><div style={{ fontWeight: 700 }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label}</div><div className="cl-muted" style={{ fontSize: 13 }}>{a.line1}, {a.postcode}</div></div>{addrId === a.id && <span>✓</span>}</div>
          </Card>
        ))}
        <div className="cl-eyebrow" style={{ margin: '16px 0 8px' }}>How should we collect?</div>
        {Object.entries(HANDOVER).map(([key, h]) => (
          <Card key={key} onClick={() => setHandover(key)} style={{ marginBottom: 10, border: handover === key ? '2px solid var(--navy)' : '2px solid transparent', cursor: 'pointer' }}>
            <div className="cl-row" style={{ gap: 12 }}>
              <span style={{ fontSize: 22 }}>{h.icon}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{h.label}</div><div className="cl-muted" style={{ fontSize: 12 }}>{h.sub}</div></div>
              {handover === key && <span>✓</span>}
            </div>
          </Card>
        ))}
        {handover === 'someone_else' && (
          <input className="cl-field" placeholder="Their name & phone (e.g. Mum · 9123 4567)" value={handoverContact} onChange={(e) => setHandoverContact(e.target.value)} style={{ marginBottom: 12, marginTop: 2 }} />
        )}

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
            <Line l="Service fee" v={quote.platform_fee_cents ? fmt.money(quote.platform_fee_cents) : 'WAIVED'} />
            <Line l="Delivery" v={quote.delivery_fee_cents ? fmt.money(quote.delivery_fee_cents) : 'FREE'} />
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
          <Card style={{ marginBottom: 14 }}>
            <div className="cl-between" onClick={() => setRepeat((x) => !x)} style={{ cursor: 'pointer' }}>
              <span style={{ fontWeight: 700 }}>🔁 Repeat this order</span>
              <span style={{ width: 44, height: 26, borderRadius: 999, background: repeat ? 'var(--lime)' : 'var(--gray3)', position: 'relative', transition: '.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: repeat ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff', transition: '.2s' }} /></span>
            </div>
            {repeat && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {Object.entries(REPEAT_CADENCE).map(([k, c]) => (
                  <Button key={k} sm variant={repeatCadence === k ? 'lime' : 'ghost'} onClick={() => setRepeatCadence(k)} style={{ flex: 1 }}>{c.label}</Button>
                ))}
              </div>
            )}
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

// reusable: search a place, pick a type (Home/Work/Other), save the address
function AddAddress({ customerId, onSaved, onCancel }) {
  const [place, setPlace] = useState(null);
  const [type, setType] = useState('home');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const a = await api.post(`/api/customers/${customerId}/addresses`, {
      type, label: (label.trim() || ADDRESS_TYPES[type].label), line1: place.line1, line2: '',
      city: 'Singapore', postcode: place.postcode, lat: place.lat, lng: place.lng, make_default: true,
    });
    setSaving(false); onSaved(a);
  };

  return (
    <Card style={{ marginBottom: 12, background: 'var(--light)' }}>
      {!place ? (
        <PlacesAutocomplete autoFocus onSelect={setPlace} placeholder="Search address or postcode…" />
      ) : <>
        <div className="cl-between" style={{ marginBottom: 12 }}>
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>📍 {place.name}</div><div className="cl-muted" style={{ fontSize: 12 }}>{place.line1} · {place.postcode}</div></div>
          <button onClick={() => setPlace(null)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Change</button>
        </div>
        <div className="cl-label">Address type</div>
        <div className="cl-row" style={{ gap: 8, marginBottom: 12 }}>
          {Object.entries(ADDRESS_TYPES).map(([k, t]) => (
            <button key={k} onClick={() => setType(k)} style={{ flex: 1, padding: '10px 0', borderRadius: 11, fontWeight: 700, fontSize: 13, border: type === k ? '2px solid var(--navy)' : '1.5px solid var(--gray3)', background: type === k ? 'var(--navy)' : '#fff', color: type === k ? '#fff' : 'var(--gray)' }}>{t.icon} {t.label}</button>
          ))}
        </div>
        {type === 'other' && <input className="cl-field" placeholder="Label (e.g. Mum's place, Gym)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ marginBottom: 12 }} />}
        <div className="cl-row" style={{ gap: 8 }}>
          {onCancel && <Button sm variant="ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>}
          <Button sm variant="lime" disabled={saving} onClick={save} style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save address'}</Button>
        </div>
      </>}
    </Card>
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
  const [topupOpen, setTopupOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);

  const loadWallet = useCallback(() => api.get(`/api/customers/${CUSTOMER_ID}/credits`).then(setData), []);
  useEffect(() => {
    loadWallet();
    api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef);
  }, [loadWallet]);

  const invite = async () => { await api.post(`/api/customers/${CUSTOMER_ID}/referrals`, { email }); setSent(true); setEmail(''); api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef); };

  if (!data) return <Loading />;
  const typeIcon = { referral: '🎁', in_store: '💚', signup: '👋', refund: '↩️', spend: '🧾', adjustment: '⚙️', topup: '➕', bonus: '🎁' };
  return (
    <div style={{ padding: 18 }}>
      <Card style={{ background: 'var(--navy)', color: '#fff', marginBottom: 16, textAlign: 'center' }}>
        <div className="cl-eyebrow" style={{ color: 'rgba(255,255,255,.4)' }}>Wallet balance</div>
        <div style={{ fontSize: 40, fontWeight: 900, margin: '8px 0' }}>{fmt.money(data.balance_cents)}</div>
        <div style={{ fontSize: 12, color: 'var(--lime)', marginBottom: 14 }}>Applied automatically at checkout</div>
        <Button variant="lime" onClick={() => setTopupOpen(true)}>+ Top up credit</Button>
      </Card>

      <TopUpSheet open={topupOpen} onClose={() => setTopupOpen(false)} balanceCents={data.balance_cents}
        onContinue={(amt) => { setTopupOpen(false); setPayAmount(amt); }} />
      <PaymentSheet open={payAmount > 0} onClose={() => setPayAmount(0)} amountCents={payAmount} cta="Top up"
        title="Top up wallet" description={`+ ${fmt.money(payAmount + topupBonus(payAmount).bonus)} credit`}
        onAuthorized={async () => { await api.post(`/api/customers/${CUSTOMER_ID}/topup`, { amount_cents: payAmount }); await loadWallet(); onReload?.(); }} />

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
  const [newOpen, setNewOpen] = useState(false);

  const load = () => api.get(`/api/customers/${CUSTOMER_ID}/threads`).then(setThreads);
  useEffect(() => { load(); }, []);

  if (active) return <Chat threadId={active} onBack={() => { setActive(null); load(); }} />;
  return (
    <div style={{ padding: 18 }}>
      <div className="cl-between" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Support</div>
        <Button sm variant="lime" onClick={() => setNewOpen(true)}>+ New ticket</Button>
      </div>
      <Card style={{ marginBottom: 14, background: 'var(--lime-pale)' }}>
        <div className="cl-row" style={{ gap: 10 }}><span style={{ fontSize: 22 }}>💬</span><div><div style={{ fontWeight: 800 }}>We reply fast one</div><div className="cl-muted" style={{ fontSize: 12 }}>Real humans, 7am–11pm daily. Just ask ah!</div></div></div>
      </Card>
      {threads.length === 0 ? <Empty icon="💬" title="No tickets yet" sub="Got problem? Raise a ticket lah" /> :
        threads.map((t) => (
          <Card key={t.id} onClick={() => setActive(t.id)} style={{ marginBottom: 10, cursor: 'pointer' }}>
            <div className="cl-between"><span style={{ fontWeight: 800 }}>{t.subject}</span><Chip variant={t.status === 'open' ? undefined : 'gray'}>{t.status.replace('_', ' ')}</Chip></div>
            <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>Updated {fmt.ago(t.updated_at)}</div>
          </Card>
        ))}
      <NewTicketSheet open={newOpen} onClose={() => setNewOpen(false)} onCreated={(t) => { setNewOpen(false); load(); setActive(t.id); }} />
    </div>
  );
}

function NewTicketSheet({ open, onClose, onCreated }) {
  const [cat, setCat] = useState('order');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setCat('order'); setSubject(''); setMessage(''); setOrderId(''); setBusy(false);
      api.get(`/api/customers/${CUSTOMER_ID}/orders`).then(setOrders);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    const c = TICKET_CATEGORIES.find((x) => x.key === cat);
    const ord = orders.find((o) => o.id === orderId);
    const t = await api.post(`/api/customers/${CUSTOMER_ID}/threads`, {
      subject: `${c.icon} ${c.label}${ord ? ` · ${ord.code}` : ''}${subject.trim() ? ` · ${subject.trim()}` : ''}`,
      order_id: orderId || undefined,
      body: message.trim() || undefined,
    });
    setBusy(false); onCreated(t);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Raise a support ticket">
      <div className="cl-eyebrow" style={{ marginBottom: 8 }}>What's it about?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {TICKET_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} style={{ textAlign: 'left', padding: '11px 12px', borderRadius: 12, fontWeight: 700, fontSize: 13, border: cat === c.key ? '2px solid var(--navy)' : '1.5px solid var(--gray3)', background: cat === c.key ? 'var(--navy)' : '#fff', color: cat === c.key ? '#fff' : 'var(--gray)' }}>{c.icon} {c.label}</button>
        ))}
      </div>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span className="cl-label">Related order (optional)</span>
        <select className="cl-field" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">— None —</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.status_label} · {fmt.money(o.total_cents)}</option>)}
        </select>
      </label>
      <Field label="Subject (optional)" placeholder="Short summary…" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div className="cl-label">How can we help?</div>
      <textarea className="cl-field" rows={4} placeholder="Tell us what happened…" value={message} onChange={(e) => setMessage(e.target.value)} style={{ marginBottom: 14 }} />
      <Button variant="lime" disabled={busy || !message.trim()} onClick={submit}>{busy ? 'Creating…' : 'Submit ticket'}</Button>
      <div className="cl-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>Our support team replies right here in chat.</div>
    </Sheet>
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
  const [payPlan, setPayPlan] = useState(null); // paid plan awaiting card auth
  const [addingAddr, setAddingAddr] = useState(false);
  useEffect(() => { api.get('/api/plans').then(setPlans); }, []);
  if (!summary) return <Loading />;
  const current = summary.subscription?.plan_id || 'plan_lite';

  const activate = (plan_id) => api.post(`/api/customers/${CUSTOMER_ID}/subscription`, { plan_id }).then(onReload);
  // free downgrade goes straight through; paid plans run the Stripe auth flow first
  const choose = (plan) => { if (plan.price_cents) setPayPlan(plan); else activate(plan.id); };

  const cancel = async () => {
    await api.post(`/api/customers/${CUSTOMER_ID}/subscription/cancel`);
    onReload();
  };

  return (
    <div style={{ padding: 18 }}>
      <Card style={{ marginBottom: 16 }}>
        <div className="cl-row" style={{ gap: 14 }}>
          <Avatar name={summary.user.name} size={52} />
          <div><div style={{ fontWeight: 900, fontSize: 18 }}>{summary.user.name}</div><div className="cl-muted" style={{ fontSize: 13 }}>{summary.user.email}</div></div>
        </div>
      </Card>

      {summary.subscription && (
        <div style={{ marginBottom: 12 }} className="cl-muted">Renews: {fmt.date(summary.subscription.renews_at)}</div>
      )}

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
            {!active && <Button sm variant={p.id === 'plan_lite' ? 'ghost' : 'lime'} onClick={() => choose(p)}>{p.id === 'plan_lite' ? 'Downgrade to Lite' : `Switch to ${p.name}`}</Button>}
            {active && p.id !== 'plan_lite' && <div style={{ marginTop: 8 }}><Button sm variant="ghost" onClick={cancel}>Cancel subscription</Button></div>}
          </Card>
        );
      })}

      <div className="cl-between" style={{ margin: '16px 0 10px' }}>
        <div className="cl-eyebrow">Addresses</div>
        <span onClick={() => setAddingAddr((x) => !x)} style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>{addingAddr ? 'Cancel' : '+ Add'}</span>
      </div>
      {addingAddr && <AddAddress customerId={CUSTOMER_ID} onSaved={() => { setAddingAddr(false); onReload(); }} onCancel={() => setAddingAddr(false)} />}
      {summary.addresses.map((a) => (
        <Card key={a.id} style={{ marginBottom: 10 }}><div style={{ fontWeight: 700 }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label} {a.is_default ? <Chip variant="gray">default</Chip> : null}</div><div className="cl-muted" style={{ fontSize: 13 }}>{a.line1}, {a.city} {a.postcode}</div></Card>
      ))}

      <div style={{ marginTop: 20 }}>
        <Button variant="ghost" onClick={logout}>Log out</Button>
      </div>

      <PaymentSheet open={!!payPlan} onClose={() => setPayPlan(null)} amountCents={payPlan?.price_cents || 0}
        recurring cta="Subscribe" title={payPlan ? `Subscribe to ${payPlan.name}` : ''} description={payPlan ? `${payPlan.name} plan` : ''}
        onAuthorized={async () => { await activate(payPlan.id); }} />
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

