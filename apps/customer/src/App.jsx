import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  api, fmt, getSocket, useSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_LABEL, HANDOVER, ADDRESS_TYPES, TICKET_CATEGORIES, REPEAT_CADENCE, nextRepeatDue,
  Logo, Mark, Button, Card, Chip, Field, Avatar, StatusPill, TopBar, BottomNav, Sheet, Empty, OneMap, GarmentJourney, PlacesAutocomplete,
  PaymentSheet, TopUpSheet, topupBonus, distKm, printInvoice, CATEGORY_CHIPS, CATEGORY_DESC, CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_TINT, CATEGORY_INFO, etaLabel,
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
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'home');
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [openOrder, setOpenOrder] = useState(null); // order id
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowSeed, setFlowSeed] = useState(null); // { cart, step } — pre-fill when jumping in from Prices
  const [notifOpen, setNotifOpen] = useState(false);

  const openOrderFlow = (seed = null) => { setFlowSeed(seed); setFlowOpen(true); };

  // deep-link: /?book=1 opens the booking flow (optionally at ?step=N)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('book')) openOrderFlow(p.get('step') ? { step: Number(p.get('step')) } : null);
  }, []);

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
            🔔{unread > 0 && <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--lime)', color: '#fff', fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread}</span>}
          </button>
        }
      />

      <div className="cl-scroll">
        {tab === 'home' && <Home summary={summary} orders={orders} onOpenOrder={setOpenOrder} onOrder={() => openOrderFlow()} onTab={setTab} onReload={load} />}
        {tab === 'prices' && <Prices onSchedule={(cart) => openOrderFlow({ cart })} onTab={setTab} />}
        {tab === 'orders' && <Orders orders={orders} onOpenOrder={setOpenOrder} onOrder={() => openOrderFlow()} />}
        {tab === 'wallet' && <Wallet onReload={load} />}
        {tab === 'support' && <Support />}
        {tab === 'account' && <Account summary={summary} orders={orders} onOpenOrder={setOpenOrder} onOrder={() => openOrderFlow()} onReload={load} onTab={setTab} openOrders={summary?.open_orders || 0} />}
      </div>

      <BottomNav
        active={tab} onChange={(k) => (k === 'book' ? openOrderFlow() : setTab(k))}
        tabs={[
          { key: 'home', label: 'Home', icon: '🏠' },
          { key: 'prices', label: 'Prices', icon: '🏷️' },
          { key: 'book', label: 'Book now', icon: '+', fab: true },
          { key: 'wallet', label: 'Prepaid', icon: '💳' },
          { key: 'account', label: 'More', icon: '☰' },
        ]}
      />

      <OrderFlow open={flowOpen} seed={flowSeed} onClose={() => setFlowOpen(false)} onPlaced={(o) => { setFlowOpen(false); load(); setOpenOrder(o.id); }} summary={summary} />
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
function Home({ summary, orders, onOpenOrder, onOrder, onTab, onReload }) {
  const [addrPickerOpen, setAddrPickerOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  if (!summary) return <Loading />;
  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const addr = summary.addresses?.find((a) => a.is_default) || summary.addresses?.[0];

  return (
    <div style={{ padding: 18 }}>
      {/* address pill */}
      <button onClick={() => setAddrPickerOpen(true)} className="cl-row" style={{ gap: 8, background: '#fff', borderRadius: 999, padding: '10px 16px', boxShadow: 'var(--shadow-sm)', marginBottom: 20, maxWidth: '100%' }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>🏠</span>
        <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.3px', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {addr ? addr.line1.toUpperCase() : 'ADD YOUR ADDRESS'}
        </span>
        <span style={{ color: 'var(--gray2)', flexShrink: 0 }}>›</span>
      </button>

      <AddressPicker open={addrPickerOpen} onClose={() => setAddrPickerOpen(false)} summary={summary} onReload={onReload} />

      {/* Laundryheap-style hero: headline · Schedule pickup CTA · star trust bar */}
      <Card style={{ marginBottom: 14, padding: 22 }}>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-.5px', color: 'var(--navy)', marginBottom: 8 }}>
          Take back your time.<br />Leave the laundry to us.
        </div>
        <div className="cl-muted" style={{ fontSize: 14, marginBottom: 16 }}>
          Laundry & dry cleaning with free 48-hour delivery, right to your door.
        </div>
        <Button variant="lime" onClick={onOrder}>Schedule your pickup →</Button>

        {/* rated-excellent star bar */}
        <div className="cl-row" style={{ gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <span className="lh-stars" style={{ fontSize: 15 }}>★★★★★</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Rated Excellent</span>
          <span className="cl-muted" style={{ fontSize: 12 }}>· 5,243 reviews</span>
        </div>

        {/* guarantees */}
        <div className="cl-divider" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Free collection & 48h delivery', 'Best price guaranteed', 'No minimum order'].map((t) => (
            <span key={t} className="cl-row" style={{ gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
              <span style={{ width: 18, height: 18, borderRadius: 18, background: 'var(--lime)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</span>
              {t}
            </span>
          ))}
        </div>
      </Card>

      {/* active orders */}
      {active.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Active orders</div>
          {active.map((o) => <OrderRow key={o.id} o={o} onClick={() => onOpenOrder(o.id)} />)}
        </div>
      )}

      {/* demo: spawn a live-tracking order */}
      <Card onClick={async () => { const o = await api.post(`/api/demo/customers/${CUSTOMER_ID}/spawn-tracking`); onOpenOrder(o.id); }}
        style={{ marginBottom: 14, border: '1.5px dashed var(--navy)', cursor: 'pointer' }}>
        <div className="cl-between">
          <div><div style={{ fontWeight: 900 }}>🚗 Track a live driver</div><div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>Demo: spawn an out-for-delivery order & watch it move</div></div>
          <span style={{ fontSize: 22 }}>→</span>
        </div>
      </Card>

      {/* getting started */}
      <Card style={{ marginBottom: 14, background: 'var(--lime-pale)' }} onClick={() => setHowOpen(true)}>
        <div className="cl-between" style={{ gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>Getting started?</div>
            <div style={{ fontSize: 12, color: 'var(--gray)' }}>See how ChaseLaundry works and learn more about our services.</div>
            <Button sm variant="navy" style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); setHowOpen(true); }}>Start now</Button>
          </div>
          <span style={{ fontSize: 30, flexShrink: 0 }}>💚</span>
        </div>
      </Card>
      <HowItWorksSheet open={howOpen} onClose={() => setHowOpen(false)} />

      {/* promo card stack */}
      <Card style={{ marginBottom: 14, background: 'var(--lime-pale)' }} onClick={() => onTab('wallet')}>
        <div className="cl-between" style={{ gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>Refer a friend</div>
            <div style={{ fontSize: 12, color: 'var(--gray)' }}>Your friend gets 15% off — you earn S$25 on their first order!</div>
            <Button sm variant="navy" style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); onTab('wallet'); }}>Invite friends</Button>
          </div>
          <span style={{ fontSize: 34, flexShrink: 0 }}>🎁</span>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }} onClick={() => onTab('wallet')}>
        <div className="cl-between" style={{ gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Prepay and save on your frequent laundry items</div>
            <Button sm variant="navy" style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); onTab('wallet'); }}>Save now</Button>
          </div>
          <div style={{
            flexShrink: 0, width: 70, height: 70, borderRadius: 70, background: 'var(--lime-pale)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.1,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--navy)' }}>up to</span>
            <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--navy)' }}>20%</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--navy)' }}>off</span>
          </div>
        </div>
      </Card>

      <div className="cl-row" style={{ marginBottom: 14, cursor: 'pointer', background: 'var(--lime-pale)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }} onClick={onOrder}>
        <div style={{
          width: 10, flexShrink: 0, height: '100%', alignSelf: 'stretch',
          background: `radial-gradient(circle 6px at 0 12px, var(--bg) 6px, transparent 7px),
                       radial-gradient(circle 6px at 0 36px, var(--bg) 6px, transparent 7px),
                       radial-gradient(circle 6px at 0 60px, var(--bg) 6px, transparent 7px),
                       radial-gradient(circle 6px at 0 84px, var(--bg) 6px, transparent 7px)`,
        }} />
        <div style={{ padding: 18, flex: 1 }}>
          <div className="cl-row" style={{ gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>🏷️</span>
            <span className="cl-eyebrow" style={{ color: 'var(--navy)' }}>Promotion</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--navy)', marginBottom: 12 }}>10% off mixed wash!</div>
          <Button sm variant="lime" onClick={(e) => { e.stopPropagation(); onOrder(); }}>Claim now</Button>
        </div>
      </div>

      <Card style={{ cursor: 'pointer' }} onClick={() => onTab('account')}>
        <div className="cl-between" style={{ gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--navy)' }}>ChaseLaundry+</div>
            <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>Skip the service fee for just S$19 / month</div>
            <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 13, marginTop: 8, display: 'inline-block' }}>Join now ›</span>
          </div>
          <span style={{ fontSize: 34, flexShrink: 0 }}>➕</span>
        </div>
      </Card>
    </div>
  );
}

function HowItWorksSheet({ open, onClose }) {
  const steps = [
    { icon: '🛍️', title: 'Book it & bag it', body: 'Pick a pickup slot and bag up your laundry — we come to your door.' },
    { icon: '🧺', title: 'Cleaned with care, locally', body: 'Your items are tagged, tracked and cared for at our local facility.' },
    { icon: '🚚', title: 'Free delivery, fresh results', body: 'Fresh and folded, delivered back to your door within 48h.' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="How ChaseLaundry works">
      {steps.map((s, i) => (
        <Card key={s.title} style={{ marginBottom: 12 }}>
          <div className="cl-row" style={{ gap: 12 }}>
            <span style={{ fontSize: 26 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{i + 1}. {s.title}</div>
              <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{s.body}</div>
            </div>
          </div>
        </Card>
      ))}
    </Sheet>
  );
}

// pick which saved address is active, or add a new one
function AddressPicker({ open, onClose, summary, onReload }) {
  const [adding, setAdding] = useState(false);
  const addresses = summary?.addresses || [];

  useEffect(() => { if (open) setAdding(false); }, [open]);

  const choose = async (a) => {
    if (!a.is_default) await api.post(`/api/customers/${CUSTOMER_ID}/addresses/${a.id}/default`);
    onReload?.();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Choose your address">
      {!adding && addresses.map((a) => (
        <Card key={a.id} onClick={() => choose(a)} style={{ marginBottom: 10, cursor: 'pointer', border: a.is_default ? '2px solid var(--navy)' : '2px solid transparent' }}>
          <div className="cl-between">
            <div><div style={{ fontWeight: 700 }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label}</div><div className="cl-muted" style={{ fontSize: 13 }}>{a.line1}, {a.postcode}</div></div>
            {a.is_default ? <span>✓</span> : null}
          </div>
        </Card>
      ))}
      {!adding ? (
        <Button variant="ghost" onClick={() => setAdding(true)}>+ Add new address</Button>
      ) : (
        <AddAddress customerId={CUSTOMER_ID} onSaved={() => { onReload?.(); onClose(); }} onCancel={() => setAdding(false)} />
      )}
    </Sheet>
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

// ─────────────────────────────────────── PRICES (Laundryheap-style pricelist)
// Wash & Fold is the primary, weight-based service (Mixed / Separate bundles);
// every other service follows the per-item pricelist flow.
// Reusable Laundryheap-style service picker: service tabs + info header +
// Wash & Fold bundle flow / per-item grouped pricelist. Shared by the Prices
// tab and the booking flow's "what needs cleaning" step so both feel identical.
function ServicePicker({ catalog, cart, setCart, initialCat, onAskTeam }) {
  const [cat, setCat] = useState(() => initialCat || 'wash_fold');
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => { setInfoOpen(false); }, [cat]);

  const categories = useMemo(() => {
    const present = new Set(catalog.map((c) => c.category));
    return CATEGORY_ORDER.filter((k) => present.has(k));
  }, [catalog]);

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const items = catalog.filter((c) => c.category === cat);
  const headIcon = items[0]?.icon || '🧺';

  if (!catalog.length) return <Loading />;

  return (
    <>
      {/* service tabs — Wash & Fold first / main */}
      <div className="cl-row cl-hscroll" style={{ gap: 8, margin: '0 -18px 16px', padding: '0 18px' }}>
        {categories.map((k) => (
          <button key={k} onClick={() => setCat(k)} style={{
            flexShrink: 0, padding: '9px 16px', borderRadius: 999, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap',
            background: cat === k ? 'var(--navy)' : '#fff', color: cat === k ? '#fff' : 'var(--gray)',
            boxShadow: cat === k ? 'none' : 'var(--shadow-sm)',
          }}>{CATEGORY_LABEL[k]}</button>
        ))}
      </div>

      {/* service info header */}
      <Card style={{ marginBottom: 16 }}>
        <div className="cl-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="cl-row" style={{ gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 44, background: CATEGORY_TINT[cat], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{headIcon}</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>{CATEGORY_LABEL[cat]}</div>
              <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{CATEGORY_DESC[cat]}</div>
            </div>
          </div>
          <button onClick={() => setInfoOpen((x) => !x)} style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}>{infoOpen ? 'Less' : 'Learn more'}</button>
        </div>
        <div className="cl-row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {(CATEGORY_CHIPS[cat] || []).map((t, i, a) => (
            <React.Fragment key={t}>
              <Chip variant="gray">{t}</Chip>
              {i < a.length - 1 && <span style={{ color: 'var(--gray2)', fontWeight: 800 }}>+</span>}
            </React.Fragment>
          ))}
        </div>
        {infoOpen && <div className="cl-muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{CATEGORY_INFO[cat]}</div>}
      </Card>

      {/* body: bundle flow for Wash & Fold, per-item pricelist for the rest */}
      {cat === 'wash_fold'
        ? <WashFoldPricelist items={items} cart={cart} setItem={setItem} />
        : <ItemPricelist items={items} cart={cart} setItem={setItem} onAskTeam={onAskTeam} />}
    </>
  );
}

function Prices({ onSchedule, onTab }) {
  const [catalog, setCatalog] = useState(null);
  const [cart, setCart] = useState({}); // catalogId -> { qty | weight }
  useEffect(() => { api.get('/api/catalog').then(setCatalog); }, []);

  if (!catalog) return <div style={{ padding: 18 }}><Loading /></div>;

  const selected = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0);
  const totalCents = selected.reduce((sum, [id, v]) => {
    const c = catalog.find((x) => x.id === id);
    return sum + (c ? c.price_cents * (v.qty || v.weight || 0) : 0);
  }, 0);
  const book = () => selected.length && onSchedule(Object.fromEntries(selected));
  const initialCat = new URLSearchParams(location.search).get('cat') || 'wash_fold';

  return (
    <div style={{ padding: 18, paddingBottom: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Prices &amp; services</div>
      <p className="cl-muted" style={{ fontSize: 13, marginBottom: 16 }}>Straightforward pricing, no surprises.</p>

      <ServicePicker catalog={catalog} cart={cart} setCart={setCart} initialCat={initialCat} onAskTeam={() => onTab('support')} />

      {/* guarantees */}
      <Card style={{ marginTop: 4 }}>
        {[['⏱️', '48h turnaround'], ['🚫', 'No minimum order'], ['🚚', 'Free collection & delivery']].map(([icon, label], i, arr) => (
          <div key={label} className="cl-row" style={{ gap: 12, marginBottom: i < arr.length - 1 ? 10 : 0 }}>
            <span style={{ width: 34, height: 34, borderRadius: 34, background: 'var(--lime-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{label}</span>
          </div>
        ))}
      </Card>

      {/* sticky BOOK NOW bar */}
      <div style={{ position: 'sticky', bottom: 12, marginTop: 16, zIndex: 5 }}>
        <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '12px 14px 14px', boxShadow: '0 10px 24px rgba(14,42,99,.28)' }}>
          {selected.length > 0 && (
            <div className="cl-between" style={{ marginBottom: 8, color: '#fff' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Estimated</span>
              <span style={{ fontWeight: 900, fontSize: 15 }}>{fmt.money(totalCents)}</span>
            </div>
          )}
          <Button variant="lime" disabled={!selected.length} onClick={book}>Book now →</Button>
        </div>
      </div>
      <div style={{ height: 12 }} />
    </div>
  );
}

// Wash & Fold — weight-based bundles (Mixed 6kg / Separate 12kg) + additional kg.
function WashFoldPricelist({ items, cart, setItem, setCart }) {
  const base = items.find((c) => /fold/i.test(c.name)) || items[0]; // "Wash & Fold" per-kg rate
  const perKg = base.price_cents;
  const BUNDLES = [
    { key: 'mixed', name: 'Mixed Wash & Fold', desc: 'All colours washed together.', kg: 6 },
    { key: 'separate', name: 'Separate Wash & Fold', desc: 'Lights and darks washed separately.', kg: 12 },
  ];
  const cur = cart[base.id]?.weight || 0;
  const activeKg = cur >= 12 ? 12 : cur >= 6 ? 6 : 0;
  const extra = Math.max(0, cur - activeKg);

  const pick = (kg) => setItem(base.id, { weight: kg });
  const setExtra = (n) => activeKg && setItem(base.id, { weight: activeKg + Math.max(0, n) });

  return (
    <>
      {BUNDLES.map((b) => {
        const on = activeKg === b.kg;
        return (
          <Card key={b.key} onClick={() => pick(b.kg)}
            style={{ marginBottom: 12, cursor: 'pointer', border: on ? '2px solid var(--navy)' : '2px solid transparent', background: on ? 'var(--lime-pale)' : '#fff' }}>
            <div className="cl-between" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{b.name}</div>
                <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{b.desc}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{fmt.money(perKg * b.kg)}</div>
                <div className="cl-muted" style={{ fontSize: 11 }}>/ {b.kg}kg</div>
              </div>
            </div>
          </Card>
        );
      })}

      {/* additional weight — "send as much as you need" */}
      <Card style={{ marginBottom: 12, background: 'var(--lime-pale)' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>What if I have more?</div>
        <div className="cl-muted" style={{ fontSize: 12, marginBottom: activeKg ? 12 : 0 }}>
          You can send as much as you need. Each additional kg costs {fmt.money(perKg)}.
        </div>
        {activeKg ? (
          <div className="cl-between">
            <span style={{ fontWeight: 700, fontSize: 13 }}>Additional weight</span>
            <Stepper value={extra} step={1} unit="kg" onChange={setExtra} />
          </div>
        ) : null}
      </Card>

      {/* what 6kg looks like */}
      <Card style={{ marginBottom: 12, background: 'var(--light)' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>See what 6kg looks like</div>
        <div className="cl-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {['12 shirts', '3 trousers', '7 underwear', '7 pairs of socks'].map((t) => <Chip key={t} variant="gray">{t}</Chip>)}
        </div>
      </Card>
    </>
  );
}

// Per-item pricelist — garment sub-group tabs + name … price rows (Dry Cleaning, Ironing, Duvets…).
function ItemPricelist({ items, cart, setItem, onAskTeam }) {
  // groups in a sensible garment order (Shirts → Tops → … → Accessories), unknowns last
  const groups = useMemo(() => {
    const ORDER = ['Shirts', 'Tops', 'Bottoms', 'Suits', 'Dresses', 'Traditional', 'Outerwear', 'Accessories', 'Home', 'Duvets', 'Bedding', 'Curtains', 'Footwear', 'Bags'];
    const present = [...new Set(items.map((c) => c.grp || 'All'))];
    return present.sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [items]);
  const [grp, setGrp] = useState(groups[0]);
  useEffect(() => { if (!groups.includes(grp)) setGrp(groups[0]); }, [groups, grp]);

  const shown = items.filter((c) => (c.grp || 'All') === grp);
  const addedInGroup = (g) => items.filter((c) => (c.grp || 'All') === g && (cart[c.id]?.qty || 0) > 0).length;

  return (
    <>
      {/* garment group tabs */}
      {groups.length > 1 && (
        <div className="cl-row cl-hscroll" style={{ gap: 18, marginBottom: 14, margin: '0 -18px 14px', padding: '0 18px 2px', borderBottom: '1px solid var(--gray3)' }}>
          {groups.map((g) => {
            const on = g === grp, n = addedInGroup(g);
            return (
              <button key={g} onClick={() => setGrp(g)} style={{
                flexShrink: 0, padding: '6px 0 10px', fontWeight: on ? 800 : 600, fontSize: 14, whiteSpace: 'nowrap',
                color: on ? 'var(--navy)' : 'var(--gray2)', borderBottom: on ? '2px solid var(--navy)' : '2px solid transparent',
              }}>{g}{n > 0 ? ` · ${n}` : ''}</button>
            );
          })}
        </div>
      )}

      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 10 }}>{grp}</div>
      <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
        {shown.map((c, i) => {
          const v = cart[c.id] || {};
          const qty = v.qty || 0;
          return (
            <div key={c.id} className="cl-between" style={{ padding: '14px 16px', borderBottom: i < shown.length - 1 ? '1px solid var(--gray3)' : 'none', gap: 12, background: qty > 0 ? 'var(--lime-pale)' : '#fff' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div className="cl-muted" style={{ fontSize: 11, marginTop: 2 }}>{etaLabel(c.eta_hours)}</div>
              </div>
              <div className="cl-row" style={{ gap: 12, flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{fmt.money(c.price_cents)}</span>
                {qty > 0
                  ? <Stepper value={qty} step={1} onChange={(q) => setItem(c.id, { qty: q })} />
                  : <Button sm variant="ghost" onClick={() => setItem(c.id, { qty: 1 })}>+ Add</Button>}
              </div>
            </div>
          );
        })}
      </Card>

      {onAskTeam && (
        <Card style={{ marginBottom: 12, cursor: 'pointer' }} onClick={onAskTeam}>
          <div className="cl-between">
            <div><div style={{ fontWeight: 800, fontSize: 14 }}>Can't find your item?</div><div style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 700, marginTop: 2 }}>Ask our team</div></div>
            <span style={{ fontSize: 20 }}>→</span>
          </div>
        </Card>
      )}
    </>
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
          <span style={{ fontWeight: 900 }}>{fmt.money(o.total_cents)} <PayChip status={o.payment_status} /></span>
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
          {o.pack_credit_cents > 0 && <Line l="Covered by prepaid pack" v={`– ${fmt.money(o.pack_credit_cents)}`} green />}
          {o.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(o.credit_applied_cents)}`} green />}
          {o.tip_cents > 0 && <Line l="Driver tip" v={fmt.money(o.tip_cents)} />}
          <div className="cl-divider" />
          <Line l={<b>Total</b>} v={<b>{fmt.money(o.total_cents)}</b>} />
        </Card>

        {o.payment_status === 'authorized' && o.status !== 'cancelled' &&
          <Card style={{ marginBottom: 10, background: 'var(--lime-pale)' }}>
            <div className="cl-row" style={{ gap: 10 }}>
              <span style={{ fontSize: 20 }}>💳</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{fmt.money(o.hold_amount_cents || o.total_cents)} held on your card</div>
                <div className="cl-muted" style={{ fontSize: 12 }}>You're only charged once your order is delivered.</div>
              </div>
            </div>
          </Card>}
        {['pending', 'voided'].includes(o.payment_status) && o.status !== 'cancelled' &&
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
        const current = s === status || (s === 'processing' && ['at_facility', 'confirmed', 'ready'].includes(status)) || (s === 'completed' && status === 'delivered');
        return (
          <div key={s} className="cl-row" style={{ gap: 12, padding: '6px 0' }}>
            <div style={{ width: 22, height: 22, borderRadius: 22, flexShrink: 0, background: done ? 'var(--lime)' : 'var(--gray3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 900 }}>{done ? '✓' : ''}</div>
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
function OrderFlow({ open, seed, onClose, onPlaced, summary }) {
  const wasOpen = useRef(false);
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
  const [noteOpen, setNoteOpen] = useState({}); // catalogId -> bool, "any special requests?" expanded
  const [tipCents, setTipCents] = useState(0);
  const [chargesInfoOpen, setChargesInfoOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [upsellPlan, setUpsellPlan] = useState(null);
  const [payPlan, setPayPlan] = useState(null); // paid plan awaiting card auth, chosen at checkout
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [skipItemStep, setSkipItemStep] = useState(false); // true when items were already chosen (e.g. from the Prices tab)

  useEffect(() => {
    if (open && !wasOpen.current) {
      api.get('/api/catalog').then(setCatalog); api.get('/api/plans').then(setPlans);
      setStep(seed?.step || 1); setCart(seed?.cart || {}); setSkipItemStep(!!(seed?.cart && Object.keys(seed.cart).length)); setNoteOpen({}); setAdding(false); setNotes(''); setHandover('hand_to_me'); setHandoverContact(''); setRepeat(false); setRepeatCadence('weekly');
      setTipCents(0); setChargesInfoOpen(false); setUpsellPlan(null); setPayPlan(null); setPromoCode(''); setPromoMsg('');
      const addrs = summary?.addresses || [];
      setAddresses(addrs); setAddrId((addrs.find((a) => a.is_default) || addrs[0])?.id || null);
    }
    wasOpen.current = open;
  }, [open, summary, seed]);

  const onAddrSaved = (a) => { setAddresses((list) => [...list, a]); setAddrId(a.id); setAdding(false); };

  const items = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0).map(([catalog_id, v]) => ({ catalog_id, qty: v.qty, weight_kg: v.weight }));

  useEffect(() => {
    if (step === 3 && items.length) api.post('/api/orders/quote', { customer_id: summary?.user.id, items, use_credit: useCredit }).then(setQuote);
    // eslint-disable-next-line
  }, [step, useCredit]);

  const itemNotes = Object.entries(cart).filter(([, v]) => v.note?.trim()).map(([cid, v]) => `${catalog.find((c) => c.id === cid)?.name}: ${v.note.trim()}`);
  const combinedNotes = [notes.trim(), ...itemNotes].filter(Boolean).join(' · ');

  const place = async () => {
    setPlacing(true);
    const o = await api.post('/api/orders', {
      customer_id: summary.user.id, address_id: addrId, items,
      pickup_slot: slot, return_slot: 'Thu · 18:00–20:00', use_credit: useCredit, notes: combinedNotes,
      handover, handover_contact: handover === 'someone_else' ? handoverContact : null,
      repeat_requested: repeat, repeat_cadence: repeat ? repeatCadence : null, tip_cents: tipCents,
    });
    setPlacing(false); onPlaced(o);
  };

  const activatePlan = (plan_id) => api.post(`/api/customers/${summary.user.id}/subscription`, { plan_id });

  // if the customer picked a checkout upsell plan, subscribe first (paid plans need card auth), then place the order
  const placeWithUpsell = async () => {
    if (upsellPlan) {
      const plan = plans.find((p) => p.id === upsellPlan);
      if (plan?.price_cents) { setPayPlan(plan); return; }
      await activatePlan(upsellPlan);
    }
    await place();
  };

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  return (
    <Sheet open={open} onClose={onClose} title={`Schedule pickup · Step ${step}/3`}>
      {step === 1 && <>
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

        <Button variant="lime" disabled={!addrId} onClick={() => setStep(skipItemStep ? 3 : 2)} style={{ marginTop: 4 }}>Next</Button>
      </>}

      {step === 2 && <>
        <p className="cl-muted" style={{ fontSize: 13, marginBottom: 14 }}>What needs cleaning?</p>
        <ServicePicker catalog={catalog} cart={cart} setCart={setCart} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
          <Button variant="lime" disabled={!items.length} onClick={() => setStep(3)}>Next</Button>
        </div>
      </>}

      {step === 3 && <>
        {!quote ? <Loading /> : <>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>Review &amp; confirm</div>
          <div className="cl-muted" style={{ fontSize: 12, marginBottom: 12 }}>💳 We hold this on your card now and only charge it when your order's delivered.</div>
          <Card style={{ marginBottom: 14 }}>
            <Line l="Subtotal" v={fmt.money(quote.subtotal_cents)} />
            <Line l="Service fee" v={quote.platform_fee_cents ? fmt.money(quote.platform_fee_cents) : 'WAIVED'} />
            <Line l="Collection & Delivery" v={quote.delivery_fee_cents ? fmt.money(quote.delivery_fee_cents) : 'FREE'} />
            {quote.pack_credit_cents > 0 && <Line l="Covered by prepaid pack" v={`– ${fmt.money(quote.pack_credit_cents)}`} green />}
            {quote.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(quote.credit_applied_cents)}`} green />}
            {tipCents > 0 && <Line l="Driver tip" v={fmt.money(tipCents)} />}
            <button onClick={() => setChargesInfoOpen((x) => !x)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginTop: 8 }}>How charges work?</button>
            {chargesInfoOpen && (
              <div className="cl-muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                We place a hold on your card at checkout and only capture it once your order is delivered. Priced per kg or item; the service fee covers collection & delivery — waived on Plus/Pro. Wallet credit is applied before the hold.
              </div>
            )}
            <div className="cl-divider" />
            <Line l={<b>Held now · charged on delivery</b>} v={<b>{fmt.money(quote.total_cents + tipCents)}</b>} />
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <div className="cl-row" style={{ gap: 8 }}>
              <input className="cl-field" placeholder="Enter gift card or code" value={promoCode} onChange={(e) => { setPromoCode(e.target.value); setPromoMsg(''); }} style={{ flex: 1 }} />
              <Button sm variant="ghost" disabled={!promoCode.trim()} onClick={() => setPromoMsg('No active promotions right now')}>Apply</Button>
            </div>
            {promoMsg && <div className="cl-muted" style={{ fontSize: 12, marginTop: 8 }}>{promoMsg}</div>}
          </Card>

          <Card style={{ marginBottom: 14 }} onClick={() => setUseCredit((x) => !x)}>
            <div className="cl-between"><span style={{ fontWeight: 700 }}>Use wallet credit ({fmt.money(summary?.balance_cents)})</span>
              <span style={{ width: 44, height: 26, borderRadius: 999, background: useCredit ? 'var(--lime)' : 'var(--gray3)', position: 'relative', transition: '.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: useCredit ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff', transition: '.2s' }} /></span>
            </div>
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Tip your driver?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 200, 400, 1000].map((amt) => (
                <Button key={amt} sm variant={tipCents === amt ? 'lime' : 'ghost'} onClick={() => setTipCents(amt)} style={{ flex: 1 }}>{amt === 0 ? 'No' : fmt.money(amt)}</Button>
              ))}
            </div>
          </Card>

          {!summary?.subscription && plans.filter((p) => p.price_cents > 0).map((p) => (
            <Card key={p.id} onClick={() => setUpsellPlan((x) => (x === p.id ? null : p.id))}
              style={{ marginBottom: 10, border: upsellPlan === p.id ? '2px solid var(--navy)' : '2px solid transparent', cursor: 'pointer' }}>
              <div className="cl-row" style={{ gap: 12 }}>
                <span style={{ width: 20, height: 20, borderRadius: 20, border: '2px solid var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {upsellPlan === p.id && <span style={{ width: 10, height: 10, borderRadius: 10, background: 'var(--navy)' }} />}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="cl-between"><b>ChaseLaundry {p.name}</b><span style={{ fontWeight: 800 }}>{fmt.money(p.price_cents)}/mo</span></div>
                  <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{p.perks[0]}</div>
                </div>
              </div>
            </Card>
          ))}

          {(() => {
            const addr = addresses.find((a) => a.id === addrId);
            const maxEta = Math.max(0, ...items.map((i) => catalog.find((c) => c.id === i.catalog_id)?.eta_hours || 0));
            return (
              <Card style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>Order details</div>

                <div className="cl-between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div className="cl-eyebrow">Collection</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{slot} · {HANDOVER[handover]?.label}</div>
                    {maxEta > 0 && <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>Estimated delivery: {etaLabel(maxEta)} after collection</div>}
                  </div>
                  <button onClick={() => setStep(1)} style={{ fontSize: 16, color: 'var(--navy)', flexShrink: 0 }}>✎</button>
                </div>
                <div className="cl-divider" />

                <div className="cl-between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className="cl-eyebrow" style={{ marginBottom: 6 }}>Services</div>
                    {items.map((i) => {
                      const c = catalog.find((x) => x.id === i.catalog_id);
                      if (!c) return null;
                      return <div key={i.catalog_id} className="cl-row" style={{ gap: 8, fontSize: 13, marginBottom: 4 }}><span>{c.icon}</span><span>{c.name} {i.weight_kg ? `· ${i.weight_kg}kg` : i.qty > 1 ? `× ${i.qty}` : ''}</span></div>;
                    })}
                  </div>
                  <button onClick={() => setStep(2)} style={{ fontSize: 16, color: 'var(--navy)', flexShrink: 0 }}>✎</button>
                </div>
                <div className="cl-divider" />

                <div className="cl-between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 13 }}>{addr ? <>{addr.line1}, {addr.postcode}</> : '—'}</div>
                  <button onClick={() => setStep(1)} style={{ fontSize: 16, color: 'var(--navy)', flexShrink: 0 }}>✎</button>
                </div>
              </Card>
            );
          })()}

          <Card style={{ marginBottom: 14, background: 'var(--lime-pale)' }}>
            <div className="cl-row" style={{ gap: 12 }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>🌱</span>
              <div>
                <div style={{ fontWeight: 900, color: 'var(--navy)', marginBottom: 2 }}>The sustainable choice</div>
                <div className="cl-muted" style={{ fontSize: 12 }}>We route deliveries efficiently and use eco-conscious detergents where possible.</div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button variant="ghost" onClick={() => setStep(skipItemStep ? 1 : 2)}>Back</Button>
            <Button variant="lime" disabled={placing} onClick={placeWithUpsell}>{placing ? 'Placing…' : `Confirm · hold ${fmt.money(quote.total_cents + tipCents)}`}</Button>
          </div>

          <PaymentSheet open={!!payPlan} onClose={() => setPayPlan(null)} amountCents={payPlan?.price_cents || 0}
            recurring cta="Subscribe & pay" title={payPlan ? `Subscribe to ${payPlan.name}` : ''} description={payPlan ? `${payPlan.name} plan` : ''}
            onAuthorized={async () => { await activatePlan(payPlan.id); setPayPlan(null); await place(); }} />
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

// a saved address row: view mode (set default / edit) or inline edit mode
function AddressRow({ a, onReload }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ label: a.label, type: a.type, line1: a.line1, line2: a.line2 || '', city: a.city, postcode: a.postcode });

  const setDefault = async () => {
    setBusy(true);
    await api.post(`/api/customers/${CUSTOMER_ID}/addresses/${a.id}/default`);
    setBusy(false); onReload?.();
  };

  const save = async () => {
    setBusy(true);
    await api.post(`/api/customers/${CUSTOMER_ID}/addresses/${a.id}`, form);
    setBusy(false); setEditing(false); onReload?.();
  };

  if (editing) {
    return (
      <Card style={{ marginBottom: 10, background: 'var(--light)' }}>
        <div className="cl-row" style={{ gap: 8, marginBottom: 10 }}>
          {Object.entries(ADDRESS_TYPES).map(([k, t]) => (
            <button key={k} onClick={() => setForm((f) => ({ ...f, type: k }))} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 700, fontSize: 12, border: form.type === k ? '2px solid var(--navy)' : '1.5px solid var(--gray3)', background: form.type === k ? 'var(--navy)' : '#fff', color: form.type === k ? '#fff' : 'var(--gray)' }}>{t.icon} {t.label}</button>
          ))}
        </div>
        {form.type === 'other' && <input className="cl-field" placeholder="Label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} style={{ marginBottom: 10 }} />}
        <input className="cl-field" placeholder="Address line 1" value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} style={{ marginBottom: 10 }} />
        <input className="cl-field" placeholder="Address line 2 (unit no., etc.)" value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} style={{ marginBottom: 10 }} />
        <div className="cl-row" style={{ gap: 8, marginBottom: 12 }}>
          <input className="cl-field" placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <input className="cl-field" placeholder="Postcode" value={form.postcode} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))} />
        </div>
        <div className="cl-row" style={{ gap: 8 }}>
          <Button sm variant="ghost" onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</Button>
          <Button sm variant="lime" disabled={busy} onClick={save} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700 }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label} {a.is_default ? <Chip variant="gray">default</Chip> : null}</div>
      <div className="cl-muted" style={{ fontSize: 13, marginTop: 2 }}>{a.line1}, {a.city} {a.postcode}</div>
      <div className="cl-row" style={{ gap: 16, marginTop: 10 }}>
        {!a.is_default && <button onClick={setDefault} disabled={busy} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{busy ? 'Setting…' : 'Set as default'}</button>}
        <button onClick={() => setEditing(true)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Edit</button>
      </div>
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
// referral code + invite — used standalone (More > Refer a friend) and inline on the Wallet page
function ReferralCard() {
  const [ref, setRef] = useState(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const load = useCallback(() => api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef), []);
  useEffect(() => { load(); }, [load]);

  const invite = async () => { await api.post(`/api/customers/${CUSTOMER_ID}/referrals`, { email }); setSent(true); setEmail(''); load(); };

  if (!ref) return <Loading />;
  return (
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
  );
}

function Wallet({ onReload }) {
  const [data, setData] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);

  const loadWallet = useCallback(() => api.get(`/api/customers/${CUSTOMER_ID}/credits`).then(setData), []);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  if (!data) return <Loading />;
  const typeIcon = { referral: '🎁', in_store: '💚', signup: '👋', refund: '↩️', spend: '🧾', adjustment: '⚙️', topup: '➕', bonus: '🎁' };
  return (
    <div style={{ padding: 18 }}>
      <Card style={{ background: 'var(--navy)', color: '#fff', marginBottom: 16, textAlign: 'center' }}>
        <div className="cl-eyebrow" style={{ color: 'rgba(255,255,255,.4)' }}>Wallet balance</div>
        <div style={{ fontSize: 40, fontWeight: 900, margin: '8px 0' }}>{fmt.money(data.balance_cents)}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginBottom: 14 }}>Applied automatically at checkout</div>
        <Button variant="lime" onClick={() => setTopupOpen(true)}>+ Top up credit</Button>
      </Card>

      <TopUpSheet open={topupOpen} onClose={() => setTopupOpen(false)} balanceCents={data.balance_cents}
        onContinue={(amt) => { setTopupOpen(false); setPayAmount(amt); }} />
      <PaymentSheet open={payAmount > 0} onClose={() => setPayAmount(0)} amountCents={payAmount} cta="Top up"
        title="Top up wallet" description={`+ ${fmt.money(payAmount + topupBonus(payAmount).bonus)} credit`}
        onAuthorized={async () => { await api.post(`/api/customers/${CUSTOMER_ID}/topup`, { amount_cents: payAmount }); await loadWallet(); onReload?.(); }} />

      <PacksSection customerId={CUSTOMER_ID} onReload={onReload} />

      <ReferralCard />

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

// prepaid quantity packs — Shop (buy a fixed kg/item bundle at a discount) + My Packs (owned balances)
function PacksSection({ customerId, onReload }) {
  const [data, setData] = useState(null); // { offers, owned, expiry_days }
  const [tab, setTab] = useState('shop');
  const [buying, setBuying] = useState(null); // { catalog_id, name, unit, tier }
  const [payAmount, setPayAmount] = useState(0);

  const load = useCallback(() => api.get(`/api/customers/${customerId}/packs`).then(setData), [customerId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Loading />;

  const buy = async () => {
    await api.post(`/api/customers/${customerId}/packs`, { catalog_id: buying.catalog_id, qty: buying.tier.qty });
    setBuying(null); setPayAmount(0); await load(); onReload?.();
  };

  const tabBtn = (key, label) => (
    <button onClick={() => setTab(key)} style={{
      padding: '8px 16px', borderRadius: 999, fontWeight: 800, fontSize: 13,
      background: tab === key ? 'var(--navy)' : 'var(--gray3)', color: tab === key ? '#fff' : 'var(--gray)',
    }}>{label}</button>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Prepaid packs</div>
      <p className="cl-muted" style={{ fontSize: 12, marginBottom: 12 }}>Unlock savings on your frequent items — separate from your wallet credit above.</p>
      <div className="cl-row" style={{ gap: 8, marginBottom: 12 }}>
        {tabBtn('shop', 'Shop')}
        {tabBtn('mine', `My Packs (${data.owned.length})`)}
      </div>

      {tab === 'shop' ? (
        data.offers.map((o) => (
          <Card key={o.catalog_id} style={{ marginBottom: 12 }}>
            <div className="cl-row" style={{ gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{o.icon}</span>
              <div style={{ fontWeight: 800 }}>{o.name} pack</div>
            </div>
            <div className="cl-row cl-hscroll" style={{ gap: 10, margin: '0 -18px', padding: '2px 18px 6px' }}>
              {o.tiers.map((t) => (
                <div key={t.qty} style={{ minWidth: 130, border: '1.5px solid var(--gray3)', borderRadius: 12, padding: 12, flexShrink: 0, marginRight: 2 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.qty}{o.unit === 'per_kg' ? 'kg' : ' items'}</div>
                  <Chip variant="navy">{t.discount_pct}% off</Chip>
                  <div style={{ marginTop: 8, fontWeight: 900 }}>{fmt.money(t.price_cents)}</div>
                  <Button sm variant="navy" style={{ marginTop: 8, width: '100%' }} onClick={() => setBuying({ catalog_id: o.catalog_id, name: o.name, unit: o.unit, tier: t })}>View offer</Button>
                </div>
              ))}
            </div>
          </Card>
        ))
      ) : (
        data.owned.length === 0 ? <Empty icon="📦" title="No prepaid packs yet" sub="Buy a pack from the Shop tab to save on your frequent services" /> :
        data.owned.map((p) => {
          const remaining = Math.max(0, p.quantity_total - p.quantity_used);
          const expired = new Date(p.expires_at) < new Date();
          return (
            <Card key={p.id} style={{ marginBottom: 10 }}>
              <div className="cl-between">
                <div className="cl-row" style={{ gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                    <div className="cl-muted" style={{ fontSize: 12 }}>{remaining}{p.unit === 'per_kg' ? 'kg' : ' items'} left · expires {fmt.date(p.expires_at)}</div>
                  </div>
                </div>
                <Chip variant={expired || remaining <= 0 ? 'gray' : 'navy'}>{expired ? 'expired' : remaining <= 0 ? 'used up' : 'active'}</Chip>
              </div>
            </Card>
          );
        })
      )}

      <Sheet open={!!buying} onClose={() => setBuying(null)} title={buying ? `${buying.name} pack` : ''}>
        {buying && <>
          <Card style={{ marginBottom: 16 }}>
            <Line l="Quantity" v={`${buying.tier.qty}${buying.unit === 'per_kg' ? 'kg' : ' items'}`} />
            <Line l="Discount" v={`${buying.tier.discount_pct}% off`} green />
            <Line l="Valid for" v={`${data.expiry_days} days`} />
            <div className="cl-divider" />
            <Line l={<b>Price</b>} v={<b>{fmt.money(buying.tier.price_cents)}</b>} />
          </Card>
          <Button variant="lime" onClick={() => setPayAmount(buying.tier.price_cents)}>Buy for {fmt.money(buying.tier.price_cents)}</Button>
        </>}
      </Sheet>

      <PaymentSheet open={payAmount > 0} onClose={() => setPayAmount(0)} amountCents={payAmount} cta="Buy pack"
        title={buying ? `Buy ${buying.name} pack` : ''} description={buying ? `${buying.tier.qty}${buying.unit === 'per_kg' ? 'kg' : ' items'}` : ''}
        onAuthorized={buy} />
    </div>
  );
}

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
// profile card: view mode, or inline edit of name + mobile number (email can't change here)
function ProfileCard({ user, onReload }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');

  const save = async () => {
    setBusy(true);
    await api.post(`/api/customers/${CUSTOMER_ID}/profile`, { name: name.trim(), phone: phone.trim() });
    setBusy(false); setEditing(false); onReload?.();
  };

  if (editing) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <div className="cl-row" style={{ gap: 14, marginBottom: 14 }}>
          <Avatar name={name || user.name} size={52} />
          <div style={{ flex: 1 }}>
            <input className="cl-field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 8 }} />
            <input className="cl-field" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="cl-muted" style={{ fontSize: 12, marginBottom: 12 }}>Email: {user.email} <span style={{ fontStyle: 'italic' }}>(can't be changed)</span></div>
        <div className="cl-row" style={{ gap: 8 }}>
          <Button sm variant="ghost" onClick={() => { setName(user.name); setPhone(user.phone || ''); setEditing(false); }} style={{ flex: 1 }}>Cancel</Button>
          <Button sm variant="lime" disabled={busy || !name.trim()} onClick={save} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="cl-between">
        <div className="cl-row" style={{ gap: 14 }}>
          <Avatar name={user.name} size={52} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{user.name}</div>
            <div className="cl-muted" style={{ fontSize: 13 }}>{user.email}</div>
            {user.phone && <div className="cl-muted" style={{ fontSize: 13 }}>{user.phone}</div>}
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', flexShrink: 0 }}>Edit</button>
      </div>
    </Card>
  );
}

// a single tappable row inside a grouped menu Card
function MenuRow({ icon, label, badge, danger, last, onClick }) {
  return (
    <button onClick={onClick} className="cl-between" style={{ width: '100%', padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--gray3)' }}>
      <span className="cl-row" style={{ gap: 10, fontWeight: 700, color: danger ? 'var(--danger)' : 'inherit' }}><span style={{ fontSize: 18 }}>{icon}</span>{label}</span>
      <span className="cl-row" style={{ gap: 8 }}>{badge ? <Chip variant="navy">{badge}</Chip> : null}{!danger && <span style={{ color: 'var(--gray2)' }}>›</span>}</span>
    </button>
  );
}

function Account({ summary, orders = [], onOpenOrder, onOrder, onReload, onTab, openOrders = 0 }) {
  const [sheet, setSheet] = useState(null); // 'profile' | 'subscriptions' | 'promotions' | 'refer' | 'repeat' | 'faq' | null
  if (!summary) return <Loading />;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>More</div>

      <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Orders</div>
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="📦" label="Past orders" badge={openOrders > 0 ? `${openOrders} active` : null} onClick={() => onTab?.('orders')} />
        <MenuRow icon="🔁" label="Repeat orders" last onClick={() => setSheet('repeat')} />
      </Card>

      <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Offers & rewards</div>
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="💳" label="My wallet" onClick={() => onTab?.('wallet')} />
        <MenuRow icon="⭐" label="Subscriptions" badge={summary.subscription ? summary.subscription.plan_name : null} onClick={() => setSheet('subscriptions')} />
        <MenuRow icon="🏷️" label="Promotions" onClick={() => setSheet('promotions')} />
        <MenuRow icon="🎁" label="Refer a friend" last onClick={() => setSheet('refer')} />
      </Card>

      <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Account & help</div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="👤" label="Account" onClick={() => setSheet('profile')} />
        <MenuRow icon="❓" label="FAQ" onClick={() => setSheet('faq')} />
        <MenuRow icon="💬" label="Help & Support" onClick={() => onTab?.('support')} />
        <MenuRow icon="🚪" label="Log out" danger last onClick={logout} />
      </Card>

      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} summary={summary} onReload={onReload} />
      <SubscriptionsSheet open={sheet === 'subscriptions'} onClose={() => setSheet(null)} summary={summary} onReload={onReload} />
      <PromotionsSheet open={sheet === 'promotions'} onClose={() => setSheet(null)} onOrder={onOrder} onTab={onTab} setSheet={setSheet} />
      <Sheet open={sheet === 'refer'} onClose={() => setSheet(null)} title="Refer a friend"><ReferralCard /></Sheet>
      <RepeatOrdersSheet open={sheet === 'repeat'} onClose={() => setSheet(null)} orders={orders} onOpenOrder={onOpenOrder} onOrder={onOrder} />
      <FAQSheet open={sheet === 'faq'} onClose={() => setSheet(null)} />
    </div>
  );
}

function ProfileSheet({ open, onClose, summary, onReload }) {
  const [addingAddr, setAddingAddr] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Account">
      <ProfileCard user={summary.user} onReload={onReload} />
      <div className="cl-between" style={{ margin: '16px 0 10px' }}>
        <div className="cl-eyebrow">Addresses</div>
        <span onClick={() => setAddingAddr((x) => !x)} style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>{addingAddr ? 'Cancel' : '+ Add'}</span>
      </div>
      {addingAddr && <AddAddress customerId={CUSTOMER_ID} onSaved={() => { setAddingAddr(false); onReload(); }} onCancel={() => setAddingAddr(false)} />}
      {summary.addresses.map((a) => <AddressRow key={a.id} a={a} onReload={onReload} />)}
    </Sheet>
  );
}

function SubscriptionsSheet({ open, onClose, summary, onReload }) {
  const [plans, setPlans] = useState([]);
  const [payPlan, setPayPlan] = useState(null);
  useEffect(() => { if (open) api.get('/api/plans').then(setPlans); }, [open]);
  const current = summary.subscription?.plan_id || 'plan_lite';

  const activate = (plan_id) => api.post(`/api/customers/${CUSTOMER_ID}/subscription`, { plan_id }).then(onReload);
  const choose = (plan) => { if (plan.price_cents) setPayPlan(plan); else activate(plan.id); };
  const cancel = async () => { await api.post(`/api/customers/${CUSTOMER_ID}/subscription/cancel`); onReload(); };

  return (
    <Sheet open={open} onClose={onClose} title="Subscriptions">
      {summary.subscription && <div style={{ marginBottom: 12 }} className="cl-muted">Renews: {fmt.date(summary.subscription.renews_at)}</div>}
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
      <PaymentSheet open={!!payPlan} onClose={() => setPayPlan(null)} amountCents={payPlan?.price_cents || 0}
        recurring cta="Subscribe" title={payPlan ? `Subscribe to ${payPlan.name}` : ''} description={payPlan ? `${payPlan.name} plan` : ''}
        onAuthorized={async () => { await activate(payPlan.id); }} />
    </Sheet>
  );
}

function PromotionsSheet({ open, onClose, onOrder, onTab, setSheet }) {
  return (
    <Sheet open={open} onClose={onClose} title="Promotions">
      <Card style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => { onClose(); onOrder?.(); }}>
        <div className="cl-eyebrow" style={{ color: 'var(--lime-d)', marginBottom: 8 }}>Promotion</div>
        <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--navy)', marginBottom: 4 }}>10% off mixed wash!</div>
        <div className="cl-muted" style={{ fontSize: 12 }}>Applied automatically on Wash & Fold orders.</div>
      </Card>
      <Card style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => { onClose(); setSheet('refer'); }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--navy)', marginBottom: 4 }}>Refer a friend 🎁</div>
        <div className="cl-muted" style={{ fontSize: 12 }}>You both get S$5.00 when they place their first order.</div>
      </Card>
      <Card style={{ cursor: 'pointer' }} onClick={() => { onClose(); setSheet('subscriptions'); }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--navy)', marginBottom: 4 }}>ChaseLaundry+</div>
        <div className="cl-muted" style={{ fontSize: 12 }}>Skip the service fee for just S$19/month.</div>
      </Card>
    </Sheet>
  );
}

function RepeatOrdersSheet({ open, onClose, orders, onOpenOrder, onOrder }) {
  const repeaters = orders.filter((o) => o.repeat_requested);
  return (
    <Sheet open={open} onClose={onClose} title="Repeat orders">
      {repeaters.length === 0
        ? <Empty icon="🔁" title="No repeat orders set up" sub="Toggle “Repeat this order” at checkout to schedule a standing pickup" />
        : repeaters.map((o) => {
          const due = nextRepeatDue(o);
          const dueNow = due && due <= new Date();
          return (
            <Card key={o.id} style={{ marginBottom: 10 }}>
              <div className="cl-between">
                <div>
                  <div style={{ fontWeight: 800 }}>{o.code}</div>
                  <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{REPEAT_CADENCE[o.repeat_cadence]?.label || 'Repeat'} · {o.items?.length || 0} item(s)</div>
                </div>
                <StatusPill status={o.status} label={o.status_label} />
              </div>
              <div className="cl-between" style={{ marginTop: 10 }}>
                <button onClick={() => onOpenOrder(o.id)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>View order ›</button>
                {dueNow && <Button sm variant="lime" onClick={onOrder}>Schedule next</Button>}
              </div>
            </Card>
          );
        })}
    </Sheet>
  );
}

function FAQSheet({ open, onClose }) {
  const faqs = [
    { q: 'How long does a service take?', a: 'Wash & Fold and Ironing are usually ready within 24h, Dry Cleaning within 48h, and Duvets & Bulky items within 72h from collection.' },
    { q: 'Is there a minimum order?', a: 'No — order as little or as much as you need.' },
    { q: 'What if my items are under-weighed or over-weighed?', a: 'We charge based on the actual weight at our facility. If it differs from your estimate, we\'ll adjust the final price automatically.' },
    { q: 'How do I cancel or reschedule a pickup?', a: 'Open the order from Past orders and contact Support before the collection window — we\'ll sort it out.' },
    { q: 'What happens if an item is damaged or lost?', a: 'Reach out via Help & Support with your order code — we investigate every case and make it right.' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="FAQ">
      {faqs.map((f) => (
        <Card key={f.q} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{f.q}</div>
          <div className="cl-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{f.a}</div>
        </Card>
      ))}
    </Sheet>
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
// payment status → chip. 'authorized' = card held at checkout, charged on delivery.
function PayChip({ status }) {
  const map = { paid: ['paid', 'navy'], authorized: ['on hold', 'gray'], voided: ['released', 'gray'], invoiced: ['invoiced', 'gray'] };
  const [label, variant] = map[status] || ['unpaid', 'gray'];
  return <Chip variant={variant}>{label}</Chip>;
}

