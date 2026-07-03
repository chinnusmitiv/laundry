import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api, fmt, getSocket, useSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_LABEL, HANDOVER, TICKET_CATEGORIES, REPEAT_CADENCE, nextRepeatDue,
  StatusPill, OneMap, GarmentJourney, Avatar, Empty, PaymentSheet, TopUpSheet, topupBonus, distKm, etaMins, printInvoice,
} from '@shared';
import { customerId, logout } from '../auth.js';

const CUSTOMER_ID = customerId();

export default function Account({ initialTab = 'orders' }) {
  const [tab, setTab] = useState(initialTab);
  const [summary, setSummary] = useState(null);
  const load = useCallback(() => api.get(`/api/customers/${CUSTOMER_ID}/summary`).then(setSummary), []);
  useEffect(() => { load(); }, [load]);

  const tabs = [['orders', 'Orders & tracking'], ['wallet', 'Wallet'], ['subscription', 'Subscription'], ['support', 'Support']];
  return (
    <div className="app-page">
      <div className="web-wrap">
        <div className="cl-between" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={summary?.user?.name} size={48} />
            <div>
              <h1 style={{ fontWeight: 900, fontSize: 26 }}>{summary?.user?.name || 'Account'}</h1>
              <span className="cl-muted">{summary?.subscription?.plan_name || 'Lite'} plan · wallet {fmt.money(summary?.balance_cents || 0)}</span>
            </div>
          </div>
          <button className="cl-btn cl-btn-ghost cl-btn-sm" style={{ width: 'auto' }} onClick={logout}>Log out</button>
        </div>
        <div className="tabs">
          {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'orders' && <Orders />}
        {tab === 'wallet' && <Wallet onReload={load} />}
        {tab === 'subscription' && <Subscription summary={summary} onReload={load} />}
        {tab === 'support' && <Support />}
      </div>
    </div>
  );
}

// ───────── ORDERS + LIVE TRACKING
function Orders() {
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [sel, setSel] = useState(null);
  const load = useCallback(() => api.get(`/api/customers/${CUSTOMER_ID}/orders`).then((o) => { setOrders(o); setSel((s) => s || o.find((x) => !['completed', 'cancelled'].includes(x.status))?.id || o[0]?.id); }), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'order:updated': load, 'notification': load }, { userId: CUSTOMER_ID, role: 'customer' }, []);
  const due = orders[0] && nextRepeatDue(orders[0]);
  const dueNow = due && due <= new Date();

  return (
    <div className="two-col">
      <div>
        {dueNow && (
          <div className="panel" style={{ marginBottom: 14, background: 'var(--navy)', color: '#fff', cursor: 'pointer' }} onClick={() => nav('/order')}>
            <div className="cl-between">
              <div><b>🔁 Time for your {REPEAT_CADENCE[orders[0].repeat_cadence]?.label.toLowerCase() || 'repeat'} order</b><div className="cl-muted" style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Same as last time — schedule your next pickup?</div></div>
              <button className="cl-btn cl-btn-lime cl-btn-sm" style={{ width: 'auto' }}>Schedule</button>
            </div>
          </div>
        )}
        {sel ? <OrderDetail orderId={sel} /> : <div className="panel"><Empty icon="📦" title="No orders yet" /></div>}
      </div>
      <div>
        <button className="cl-btn cl-btn-ghost cl-btn-sm" style={{ marginBottom: 12, width: 'auto', border: '1.5px dashed var(--navy)' }}
          onClick={async () => { const o = await api.post(`/api/demo/customers/${CUSTOMER_ID}/spawn-tracking`); load(); setSel(o.id); }}>🚗 Demo: track a live driver</button>
        <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Your orders</div>
        {orders.map((o) => (
          <div key={o.id} className="panel" onClick={() => setSel(o.id)} style={{ marginBottom: 10, cursor: 'pointer', padding: 16, border: sel === o.id ? '2px solid var(--navy)' : '2px solid transparent' }}>
            <div className="cl-between"><b>{o.code}</b><StatusPill status={o.status} label={o.status_label} /></div>
            <div className="cl-between" style={{ marginTop: 6 }}><span className="cl-muted" style={{ fontSize: 13 }}>{fmt.date(o.created_at)}</span><b>{fmt.money(o.total_cents)}</b></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderDetail({ orderId }) {
  const [o, setO] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [autoDrive, setAutoDrive] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const reload = useCallback(() => api.get(`/api/orders/${orderId}`).then((x) => { setO(x); setDriverLoc(x.location); }), [orderId]);
  useEffect(() => { reload(); }, [reload]);
  useSocket({
    'order:updated': (u) => { if (u.id === orderId) setO(u); },
    'driver:location': (loc) => { if (loc.order_id === orderId) setDriverLoc(loc); },
    'garment:updated': () => reload(),
  }, { userId: CUSTOMER_ID }, [orderId]);
  useEffect(() => { getSocket().emit('watch:order', orderId); return () => getSocket().emit('unwatch:order', orderId); }, [orderId]);

  // live tracking: auto-advance driver toward the address while en route
  const enRoute = o && ['driver_en_route', 'out_for_delivery'].includes(o.status) && o.address;
  useEffect(() => {
    if (!enRoute || !autoDrive) return;
    const t = setInterval(() => { api.post(`/api/demo/orders/${orderId}/simulate-drive`, {}).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [enRoute, autoDrive, orderId]);

  if (!o) return <div className="panel">Loading…</div>;
  const showMap = enRoute;
  const idx = STATUS_FLOW.indexOf(o.status);
  const driver = driverLoc || o.location;
  const km = driver?.lat && o.address?.lat ? distKm(driver, o.address) : null;
  const eta = etaMins(km);

  return (
    <div className="panel">
      <div className="cl-between" style={{ marginBottom: 16 }}>
        <div><h2 style={{ fontWeight: 900 }}>{o.code}</h2><StatusPill status={o.status} label={o.status_label} /></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 900, fontSize: 20 }}>{fmt.money(o.total_cents)}</div><span className={`cl-chip ${o.payment_status === 'paid' ? 'cl-chip-navy' : 'cl-chip-gray'}`}>{o.payment_status}</span></div>
      </div>

      {showMap && <div style={{ marginBottom: 18 }}>
        <OneMap driver={driver} dest={o.address} height={220} />
        <div className="cl-between" style={{ marginTop: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14 }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: 'var(--ok)', animation: 'clLive 1.6s infinite' }} />
            <b>{o.driver?.name?.split(' ')[0] || 'Driver'}</b>
            <span className="cl-muted">{km != null ? `· ${km.toFixed(1)} km away` : '· on the way'}</span>
          </span>
          {eta != null && <span style={{ fontWeight: 900, fontSize: 15 }}>~{eta} min away</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="cl-btn cl-btn-ghost cl-btn-sm" style={{ width: 'auto' }} onClick={() => setAutoDrive((a) => !a)}>{autoDrive ? '⏸ Pause live' : '▶ Resume live'}</button>
          <button className="cl-btn cl-btn-ghost cl-btn-sm" style={{ width: 'auto' }} onClick={() => api.post(`/api/demo/orders/${orderId}/simulate-drive`, {})}>Advance ›</button>
        </div>
        <style>{`@keyframes clLive{0%{box-shadow:0 0 0 0 rgba(22,163,74,.5)}70%{box-shadow:0 0 0 8px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}`}</style>
      </div>}

      {o.handover && HANDOVER[o.handover] && <div className="cl-between" style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--light)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>{HANDOVER[o.handover].icon}</span><span><b>{HANDOVER[o.handover].label}</b>{o.handover_contact && <div className="cl-muted" style={{ fontSize: 13 }}>{o.handover_contact}</div>}</span></span>
      </div>}

      {o.transfer
        ? <div style={{ fontSize: 13, marginBottom: 14, color: 'var(--navy)', fontWeight: 700 }}>🚚 Moving from {o.transfer.from?.name || 'our hub'} to <b>{o.transfer.to?.name}</b> for specialist care</div>
        : o.facility && <div className="cl-muted" style={{ fontSize: 13, marginBottom: 14 }}>🏭 Processed at <b>{o.facility.name}</b>, {o.facility.area}</div>}

      {o.notes && <div className="panel" style={{ marginBottom: 20, background: 'var(--lime-pale)', border: '1.5px dashed var(--lime-d)' }}>
        <div className="cl-eyebrow" style={{ color: 'var(--navy)', marginBottom: 6 }}>Special Instructions / Garment Notes</div>
        <div style={{ fontSize: 14, color: 'var(--navy)', fontStyle: 'italic' }}>“{o.notes}”</div>
      </div>}

      {/* status timeline */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['placed', 'driver_en_route', 'picked_up', 'processing', 'out_for_delivery', 'completed'].map((s) => {
          const done = STATUS_FLOW.indexOf(s) <= idx || (s === 'processing' && ['at_facility', 'ready'].includes(o.status)) || (s === 'completed' && o.status === 'delivered');
          return <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 6, borderRadius: 6, background: done ? 'var(--lime)' : 'var(--gray3)' }} />
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: done ? 'var(--navy)' : 'var(--gray2)' }}>{STATUS_LABEL[s]}</div>
          </div>;
        })}
      </div>

      {/* garment tracking with journeys */}
      {o.garments?.length > 0 && <div style={{ marginBottom: 18 }}>
        <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Item tracking ({o.garments.length})</div>
        {o.garments.map((g) => (
          <div key={g.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray3)' }}>
            <div className="cl-between" style={{ marginBottom: 8 }}>
              <div><b>{g.type}</b> <span className="cl-muted">· {g.color}</span><div className="cl-muted" style={{ fontSize: 12 }}>🏷️ {g.tag_code}{g.care ? ` · ${g.care}` : ''}</div></div>
              <span className={`cl-chip ${['packed', 'returned'].includes(g.status) ? 'cl-chip-navy' : ''}`}>{GARMENT_LABEL[g.status]}</span>
            </div>
            <GarmentJourney garment={g} />
          </div>
        ))}
      </div>}

      {/* receipt */}
      <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Receipt</div>
      {o.items.map((i) => <div key={i.id} className="cl-between" style={{ fontSize: 14, padding: '3px 0' }}><span>{i.name}{i.weight_kg ? ` (${i.weight_kg}kg)` : i.qty > 1 ? ` ×${i.qty}` : ''}</span><span className="cl-muted">{fmt.money(i.price_cents)}</span></div>)}
      <div className="cl-divider" />
      <div className="cl-between" style={{ fontSize: 14 }}><span className="cl-muted">Service fee</span><span>{o.platform_fee_cents ? fmt.money(o.platform_fee_cents) : 'WAIVED'}</span></div>
      {o.discount_cents > 0 && <div className="cl-between" style={{ fontSize: 14 }}><span className="cl-muted">Discount</span><span style={{ color: 'var(--ok)' }}>– {fmt.money(o.discount_cents)}</span></div>}
      {o.credit_applied_cents > 0 && <div className="cl-between" style={{ fontSize: 14 }}><span className="cl-muted">Wallet credit</span><span style={{ color: 'var(--ok)' }}>– {fmt.money(o.credit_applied_cents)}</span></div>}
      <div className="cl-between" style={{ marginTop: 6 }}><b>Total</b><b>{fmt.money(o.total_cents)}</b></div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {o.payment_status !== 'paid' && o.status !== 'cancelled' &&
          <button className="cl-btn cl-btn-lime" style={{ width: 'auto' }} onClick={() => setPayOpen(true)}>Pay {fmt.money(o.total_cents)}</button>}
        <button className="cl-btn cl-btn-ghost" style={{ width: 'auto' }} onClick={() => printInvoice(o)}>🧾 Download invoice</button>
      </div>

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} amountCents={o.total_cents}
        title="Complete payment" description={o.code}
        onAuthorized={async () => { await api.post(`/api/orders/${o.id}/pay`); reload(); }} />
    </div>
  );
}

// ───────── WALLET
function Wallet({ onReload }) {
  const [data, setData] = useState(null);
  const [ref, setRef] = useState(null);
  const [email, setEmail] = useState('');
  const [topupOpen, setTopupOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const reload = () => { api.get(`/api/customers/${CUSTOMER_ID}/credits`).then(setData); api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef); };
  useEffect(() => { reload(); }, []);
  const invite = async () => { await api.post(`/api/customers/${CUSTOMER_ID}/referrals`, { email }); setEmail(''); reload(); };
  if (!data) return <div className="panel">Loading…</div>;
  const icon = { referral: '🎁', in_store: '💚', signup: '👋', refund: '↩️', spend: '🧾', adjustment: '⚙️', topup: '➕', bonus: '🎁' };
  return (
    <div className="two-col">
      <div className="panel">
        <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Credit history</div>
        {data.ledger.map((l) => (
          <div key={l.id} className="cl-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--gray3)' }}>
            <span>{icon[l.type] || '•'} {l.reason} <span className="cl-muted" style={{ fontSize: 12 }}>· {fmt.ago(l.created_at)}</span></span>
            <b style={{ color: l.amount_cents < 0 ? 'var(--gray)' : 'var(--ok)' }}>{l.amount_cents < 0 ? '' : '+'}{fmt.money(l.amount_cents)}</b>
          </div>
        ))}
      </div>
      <div>
        <div className="panel" style={{ background: 'var(--navy)', color: '#fff', textAlign: 'center', marginBottom: 16 }}>
          <div className="cl-eyebrow" style={{ color: 'rgba(255,255,255,.4)' }}>Wallet balance</div>
          <div style={{ fontSize: 40, fontWeight: 900, margin: '8px 0' }}>{fmt.money(data.balance_cents)}</div>
          <div style={{ fontSize: 12, color: 'var(--lime)', marginBottom: 14 }}>Applied automatically at checkout</div>
          <button className="cl-btn cl-btn-lime" onClick={() => setTopupOpen(true)}>+ Top up credit</button>
        </div>

        <TopUpSheet open={topupOpen} onClose={() => setTopupOpen(false)} onContinue={(amt) => { setTopupOpen(false); setPayAmount(amt); }} />
        <PaymentSheet open={payAmount > 0} onClose={() => setPayAmount(0)} amountCents={payAmount} cta="Top up"
          title="Top up wallet" description={`+ ${fmt.money(payAmount + topupBonus(payAmount).bonus)} credit`}
          onAuthorized={async () => { await api.post(`/api/customers/${CUSTOMER_ID}/topup`, { amount_cents: payAmount }); reload(); onReload?.(); }} />

        <div className="panel">
          <b>Refer a friend 🎁</b>
          <p className="cl-muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>You both get {fmt.money(ref?.reward_cents || 500)}.</p>
          <div className="cl-between" style={{ background: 'var(--lime-pale)', padding: '10px 14px', borderRadius: 10, marginBottom: 12 }}><b style={{ letterSpacing: '1px' }}>{ref?.code}</b><span className="cl-chip">your code</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="cl-field" placeholder="friend@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="cl-btn cl-btn-lime cl-btn-sm" disabled={!email} onClick={invite}>Invite</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── SUBSCRIPTION
function Subscription({ summary, onReload }) {
  const [plans, setPlans] = useState([]);
  useEffect(() => { api.get('/api/plans').then(setPlans); }, []);
  const current = summary?.subscription?.plan_id || 'plan_lite';
  const choose = async (plan_id) => { await api.post(`/api/customers/${CUSTOMER_ID}/subscription`, { plan_id }); onReload(); };
  return (
    <div className="price-grid">
      {plans.map((p) => {
        const active = p.id === current;
        return (
          <div key={p.id} className={`price ${active ? 'feat-plan' : ''}`}>
            {active && <span className="cl-chip cl-chip-navy" style={{ position: 'absolute', top: -12, left: 32 }}>Current plan</span>}
            <div style={{ fontWeight: 900, fontSize: 22 }}>{p.name}</div>
            <div className="amt">{p.price_cents ? fmt.money(p.price_cents) : 'Free'}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray)' }}>{p.price_cents ? '/mo' : ''}</span></div>
            <ul>{p.perks.map((perk, i) => <li key={i}>{perk}</li>)}</ul>
            <button className={`cl-btn ${active ? 'cl-btn-ghost' : 'cl-btn-lime'}`} disabled={active} onClick={() => choose(p.id)}>{active ? 'Active' : p.id === 'plan_lite' ? 'Downgrade' : `Switch to ${p.name}`}</button>
          </div>
        );
      })}
    </div>
  );
}

// ───────── SUPPORT
function Support() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [creating, setCreating] = useState(false);
  const load = () => api.get(`/api/customers/${CUSTOMER_ID}/threads`).then((t) => { setThreads(t); setActive((a) => a || t[0]?.id); });
  useEffect(() => { load(); }, []);
  const onCreated = (t) => { setCreating(false); load(); setActive(t.id); };
  return (
    <div className="two-col">
      <div>{creating ? <NewTicket onCreated={onCreated} onCancel={() => setCreating(false)} />
        : active ? <Chat threadId={active} /> : <div className="panel"><Empty icon="💬" title="No conversations" /></div>}</div>
      <div>
        <button className="cl-btn cl-btn-lime cl-btn-sm" style={{ marginBottom: 12 }} onClick={() => setCreating(true)}>+ New ticket</button>
        {threads.map((t) => (
          <div key={t.id} className="panel" onClick={() => { setCreating(false); setActive(t.id); }} style={{ marginBottom: 10, padding: 14, cursor: 'pointer', border: active === t.id && !creating ? '2px solid var(--navy)' : '2px solid transparent' }}>
            <div className="cl-between"><b style={{ fontSize: 14 }}>{t.subject}</b><span className={`cl-chip ${t.status === 'open' ? '' : 'cl-chip-gray'}`}>{t.status}</span></div>
            <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>Updated {fmt.ago(t.updated_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewTicket({ onCreated, onCancel }) {
  const [cat, setCat] = useState('order');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/api/customers/${CUSTOMER_ID}/orders`).then(setOrders); }, []);
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
    <div className="panel">
      <div className="cl-between" style={{ marginBottom: 16 }}><h2 style={{ fontWeight: 900 }}>Raise a support ticket</h2><button onClick={onCancel} style={{ color: 'var(--gray)', fontWeight: 600 }}>Cancel</button></div>
      <div className="cl-eyebrow" style={{ marginBottom: 8 }}>What's it about?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {TICKET_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14, border: cat === c.key ? '2px solid var(--navy)' : '1.5px solid var(--gray3)', background: cat === c.key ? 'var(--navy)' : '#fff', color: cat === c.key ? '#fff' : 'var(--gray)' }}>{c.icon} {c.label}</button>
        ))}
      </div>
      <label className="cl-label">Related order (optional)</label>
      <select className="cl-field" style={{ width: '100%', marginBottom: 14 }} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
        <option value="">— None —</option>
        {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.status_label} · {fmt.money(o.total_cents)}</option>)}
      </select>
      <label className="cl-label">Subject (optional)</label>
      <input className="cl-field" style={{ width: '100%', marginBottom: 14 }} placeholder="Short summary…" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <label className="cl-label">How can we help?</label>
      <textarea className="cl-field" rows={5} style={{ width: '100%', marginBottom: 16, resize: 'vertical' }} placeholder="Tell us what happened…" value={message} onChange={(e) => setMessage(e.target.value)} />
      <button className="cl-btn cl-btn-lime" disabled={busy || !message.trim()} onClick={submit}>{busy ? 'Creating…' : 'Submit ticket'}</button>
    </div>
  );
}

function Chat({ threadId }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const load = useCallback(() => api.get(`/api/threads/${threadId}`).then(setThread), [threadId]);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'support:message': (m) => { if (m.thread_id === threadId) load(); } }, { userId: CUSTOMER_ID }, [threadId]);
  useEffect(() => { getSocket().emit('watch:thread', threadId); }, [threadId]);
  const send = async () => { if (!text.trim()) return; await api.post(`/api/threads/${threadId}/messages`, { sender_role: 'customer', sender_id: CUSTOMER_ID, body: text }); setText(''); load(); };
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: 520, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--gray3)' }}><b>{thread?.subject}</b><div className="cl-muted" style={{ fontSize: 12 }}>ChaseLaundry Support</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {thread?.messages?.map((m) => {
          const mine = m.sender_role === 'customer';
          return <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
            <div style={{ background: mine ? 'var(--navy)' : 'var(--light)', color: mine ? '#fff' : 'var(--text)', padding: '10px 14px', borderRadius: 14, fontSize: 14 }}>{m.body}</div>
            <div className="cl-muted" style={{ fontSize: 10, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>{mine ? 'You' : 'Support'} · {fmt.time(m.created_at)}</div>
          </div>;
        })}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--gray3)', display: 'flex', gap: 8 }}>
        <input className="cl-field" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="cl-btn cl-btn-lime cl-btn-sm" onClick={send}>Send</button>
      </div>
    </div>
  );
}
