import React, { useEffect, useState, useCallback } from 'react';
import {
  api, fmt, getSocket, useSocket, STATUS_FLOW, STATUS_LABEL, GARMENT_LABEL,
  StatusPill, OneMap, GarmentJourney, Avatar, Empty,
} from '@shared';

const CUSTOMER_ID = 'cus_1';

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
  const [orders, setOrders] = useState([]);
  const [sel, setSel] = useState(null);
  const load = useCallback(() => api.get(`/api/customers/${CUSTOMER_ID}/orders`).then((o) => { setOrders(o); setSel((s) => s || o.find((x) => !['completed', 'cancelled'].includes(x.status))?.id || o[0]?.id); }), []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'order:updated': load, 'notification': load }, { userId: CUSTOMER_ID, role: 'customer' }, []);

  return (
    <div className="two-col">
      <div>{sel ? <OrderDetail orderId={sel} /> : <div className="panel"><Empty icon="📦" title="No orders yet" /></div>}</div>
      <div>
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
  const reload = useCallback(() => api.get(`/api/orders/${orderId}`).then((x) => { setO(x); setDriverLoc(x.location); }), [orderId]);
  useEffect(() => { reload(); }, [reload]);
  useSocket({
    'order:updated': (u) => { if (u.id === orderId) setO(u); },
    'driver:location': (loc) => { if (loc.order_id === orderId) setDriverLoc(loc); },
    'garment:updated': () => reload(),
  }, { userId: CUSTOMER_ID }, [orderId]);
  useEffect(() => { getSocket().emit('watch:order', orderId); return () => getSocket().emit('unwatch:order', orderId); }, [orderId]);

  if (!o) return <div className="panel">Loading…</div>;
  const showMap = ['driver_en_route', 'out_for_delivery'].includes(o.status) && o.address;
  const idx = STATUS_FLOW.indexOf(o.status);

  return (
    <div className="panel">
      <div className="cl-between" style={{ marginBottom: 16 }}>
        <div><h2 style={{ fontWeight: 900 }}>{o.code}</h2><StatusPill status={o.status} label={o.status_label} /></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 900, fontSize: 20 }}>{fmt.money(o.total_cents)}</div><span className={`cl-chip ${o.payment_status === 'paid' ? 'cl-chip-navy' : 'cl-chip-gray'}`}>{o.payment_status}</span></div>
      </div>

      {showMap && <div style={{ marginBottom: 18 }}>
        <OneMap driver={driverLoc} dest={o.address} height={220} />
        <div className="cl-muted" style={{ fontSize: 13, marginTop: 8 }}>{o.driver?.name} is on the way to {o.address?.postcode}.</div>
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
      <div className="cl-between" style={{ fontSize: 14 }}><span className="cl-muted">Platform fee</span><span>{fmt.money(o.platform_fee_cents)}</span></div>
      {o.discount_cents > 0 && <div className="cl-between" style={{ fontSize: 14 }}><span className="cl-muted">Discount</span><span style={{ color: 'var(--ok)' }}>– {fmt.money(o.discount_cents)}</span></div>}
      {o.credit_applied_cents > 0 && <div className="cl-between" style={{ fontSize: 14 }}><span className="cl-muted">Wallet credit</span><span style={{ color: 'var(--ok)' }}>– {fmt.money(o.credit_applied_cents)}</span></div>}
      <div className="cl-between" style={{ marginTop: 6 }}><b>Total</b><b>{fmt.money(o.total_cents)}</b></div>

      {o.payment_status !== 'paid' && o.status !== 'cancelled' &&
        <button className="cl-btn cl-btn-lime" style={{ marginTop: 18 }} onClick={async () => { await api.post(`/api/orders/${o.id}/pay`); reload(); }}>Pay {fmt.money(o.total_cents)}</button>}
    </div>
  );
}

// ───────── WALLET
function Wallet({ onReload }) {
  const [data, setData] = useState(null);
  const [ref, setRef] = useState(null);
  const [email, setEmail] = useState('');
  const reload = () => { api.get(`/api/customers/${CUSTOMER_ID}/credits`).then(setData); api.get(`/api/customers/${CUSTOMER_ID}/referrals`).then(setRef); };
  useEffect(() => { reload(); }, []);
  const invite = async () => { await api.post(`/api/customers/${CUSTOMER_ID}/referrals`, { email }); setEmail(''); reload(); };
  if (!data) return <div className="panel">Loading…</div>;
  const icon = { referral: '🎁', in_store: '💚', signup: '👋', refund: '↩️', spend: '🧾', adjustment: '⚙️' };
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
          <div style={{ fontSize: 12, color: 'var(--lime)' }}>Applied automatically at checkout</div>
        </div>
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
  const load = () => api.get(`/api/customers/${CUSTOMER_ID}/threads`).then((t) => { setThreads(t); setActive((a) => a || t[0]?.id); });
  useEffect(() => { load(); }, []);
  return (
    <div className="two-col">
      <div>{active ? <Chat threadId={active} /> : <div className="panel"><Empty icon="💬" title="No conversations" /></div>}</div>
      <div>
        <button className="cl-btn cl-btn-lime cl-btn-sm" style={{ marginBottom: 12 }} onClick={async () => { const t = await api.post(`/api/customers/${CUSTOMER_ID}/threads`, { subject: 'New conversation' }); load(); setActive(t.id); }}>+ New chat</button>
        {threads.map((t) => (
          <div key={t.id} className="panel" onClick={() => setActive(t.id)} style={{ marginBottom: 10, padding: 14, cursor: 'pointer', border: active === t.id ? '2px solid var(--navy)' : '2px solid transparent' }}>
            <div className="cl-between"><b style={{ fontSize: 14 }}>{t.subject}</b><span className={`cl-chip ${t.status === 'open' ? '' : 'cl-chip-gray'}`}>{t.status}</span></div>
            <div className="cl-muted" style={{ fontSize: 12, marginTop: 4 }}>Updated {fmt.ago(t.updated_at)}</div>
          </div>
        ))}
      </div>
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
