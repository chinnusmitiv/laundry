import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt, PlacesAutocomplete } from '@shared';

const CUSTOMER_ID = 'cus_1';

export default function Order() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cart, setCart] = useState({});
  const [slot, setSlot] = useState('Today · 18:00–20:00');
  const [useCredit, setUseCredit] = useState(true);
  const [quote, setQuote] = useState(null);
  const [placed, setPlaced] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api.get('/api/catalog').then(setCatalog);
    api.get(`/api/customers/${CUSTOMER_ID}/summary`).then((s) => {
      setSummary(s); setAddresses(s.addresses || []);
      setAddrId((s.addresses?.find((a) => a.is_default) || s.addresses?.[0])?.id || null);
    });
  }, []);

  const addPlace = async (p) => {
    const a = await api.post(`/api/customers/${CUSTOMER_ID}/addresses`, {
      label: p.name, line1: p.line1, line2: '', city: 'Singapore', postcode: p.postcode, lat: p.lat, lng: p.lng, make_default: true,
    });
    setAddresses((list) => [...list, a]); setAddrId(a.id); setAdding(false);
  };

  const items = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0)
    .map(([catalog_id, v]) => ({ catalog_id, qty: v.qty, weight_kg: v.weight }));

  useEffect(() => {
    if (step === 3 && items.length) api.post('/api/orders/quote', { customer_id: CUSTOMER_ID, items, use_credit: useCredit }).then(setQuote);
    // eslint-disable-next-line
  }, [step, useCredit]);

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const place = async () => {
    setPlacing(true);
    const o = await api.post('/api/orders', { customer_id: CUSTOMER_ID, address_id: addrId, items, pickup_slot: slot, return_slot: 'Thu · 18:00–20:00', use_credit: useCredit, notes });
    setPlacing(false); setPlaced(o); setStep(4);
  };

  return (
    <div className="app-page">
      <div className="web-wrap" style={{ maxWidth: 880 }}>
        <Steps step={step} />
        {step === 1 && (
          <div className="two-col">
            <div className="panel">
              <h2 style={{ fontWeight: 900, marginBottom: 6 }}>What needs cleaning?</h2>
              <p className="cl-muted" style={{ marginBottom: 20 }}>Add items by weight or by piece.</p>
              {catalog.map((c) => {
                const v = cart[c.id] || {};
                return (
                  <div key={c.id} className="cl-between" style={{ padding: '14px 0', borderBottom: '1px solid var(--gray3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 28 }}>{c.icon}</span>
                      <div><div style={{ fontWeight: 800 }}>{c.name}</div><div className="cl-muted" style={{ fontSize: 13 }}>{fmt.money(c.price_cents)} / {c.unit === 'per_kg' ? 'kg' : 'item'} · {c.eta_hours}h</div></div>
                    </div>
                    {c.unit === 'per_kg'
                      ? <Stepper value={v.weight || 0} step={0.5} unit="kg" onChange={(weight) => setItem(c.id, { weight })} />
                      : <Stepper value={v.qty || 0} step={1} onChange={(qty) => setItem(c.id, { qty })} />}
                  </div>
                );
              })}
            </div>
            <CartSummary items={items} catalog={catalog} onNext={() => setStep(2)} canNext={items.length > 0} nextLabel="Choose a slot" />
          </div>
        )}

        {step === 2 && (
          <div className="two-col">
            <div className="panel">
              <h2 style={{ fontWeight: 900, marginBottom: 16 }}>Collection slot</h2>
              {['Today · 18:00–20:00', 'Tomorrow · 08:00–10:00', 'Tomorrow · 18:00–20:00', 'Sat · 10:00–12:00'].map((s) => (
                <div key={s} onClick={() => setSlot(s)} className="cl-between" style={{ padding: 16, borderRadius: 12, marginBottom: 10, cursor: 'pointer', border: slot === s ? '2px solid var(--navy)' : '2px solid var(--gray3)' }}>
                  <b>{s}</b>{slot === s && <span>✓</span>}
                </div>
              ))}
              <div className="cl-between" style={{ margin: '22px 0 10px' }}>
                <h3 style={{ fontWeight: 800 }}>Pickup address</h3>
                <button className="cl-btn cl-btn-ghost cl-btn-sm" onClick={() => setAdding((x) => !x)}>{adding ? 'Cancel' : '+ Add address'}</button>
              </div>
              {adding && <div style={{ marginBottom: 12 }}>
                <PlacesAutocomplete autoFocus onSelect={addPlace} placeholder="e.g. Tiong Bahru, 168732, ION Orchard…" />
              </div>}
              {addresses.map((a) => (
                <div key={a.id} onClick={() => setAddrId(a.id)} className="cl-between" style={{ padding: 16, borderRadius: 12, marginBottom: 10, cursor: 'pointer', border: addrId === a.id ? '2px solid var(--navy)' : '2px solid var(--gray3)' }}>
                  <div><b>{a.label}</b><div className="cl-muted" style={{ fontSize: 14 }}>{a.line1}, {a.city} {a.postcode}</div></div>
                  {addrId === a.id && <span>✓</span>}
                </div>
              ))}
              <div style={{ margin: '22px 0 10px' }}>
                <h3 style={{ fontWeight: 800 }}>Special Instructions / Garment Notes</h3>
              </div>
              <textarea className="cl-field" rows={3} placeholder="E.g., 2 Oxford shirts (White/Blue), tumble dry low for chinos..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', marginBottom: 12, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                <button className="cl-btn cl-btn-ghost" style={{ width: 'auto' }} onClick={() => setStep(1)}>← Back</button>
                <button className="cl-btn cl-btn-lime" style={{ width: 'auto' }} disabled={!addrId} onClick={() => setStep(3)}>Review order →</button>
              </div>
            </div>
            <CartSummary items={items} catalog={catalog} hideCta />
          </div>
        )}

        {step === 3 && (
          <div className="two-col">
            <div className="panel">
              <h2 style={{ fontWeight: 900, marginBottom: 16 }}>Review & confirm</h2>
              {!quote ? <p>Calculating…</p> : <>
                <Row l="Subtotal" v={fmt.money(quote.subtotal_cents)} />
                <Row l="Platform fee" v={fmt.money(quote.platform_fee_cents)} />
                <Row l="Delivery" v={quote.delivery_fee_cents ? fmt.money(quote.delivery_fee_cents) : 'FREE'} />
                {quote.discount_cents > 0 && <Row l={`${summary?.subscription?.plan_name || 'Plan'} discount`} v={`– ${fmt.money(quote.discount_cents)}`} green />}
                {quote.credit_applied_cents > 0 && <Row l="Wallet credit" v={`– ${fmt.money(quote.credit_applied_cents)}`} green />}
                <div className="cl-divider" />
                <Row l={<b style={{ fontSize: 18 }}>Total today</b>} v={<b style={{ fontSize: 18 }}>{fmt.money(quote.total_cents)}</b>} />
                <label className="cl-between" style={{ marginTop: 16, cursor: 'pointer' }} onClick={() => setUseCredit((x) => !x)}>
                  <span style={{ fontWeight: 700 }}>Use wallet credit ({fmt.money(summary?.balance_cents || 0)})</span>
                  <span style={{ width: 44, height: 26, borderRadius: 999, background: useCredit ? 'var(--lime)' : 'var(--gray3)', position: 'relative' }}><span style={{ position: 'absolute', top: 3, left: useCredit ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff' }} /></span>
                </label>
                <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                  <button className="cl-btn cl-btn-ghost" style={{ width: 'auto' }} onClick={() => setStep(2)}>← Back</button>
                  <button className="cl-btn cl-btn-lime" style={{ width: 'auto' }} disabled={placing} onClick={place}>{placing ? 'Placing…' : 'Place order'}</button>
                </div>
              </>}
            </div>
            <CartSummary items={items} catalog={catalog} hideCta />
          </div>
        )}

        {step === 4 && placed && (
          <div className="panel" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: 60 }}>🎉</div>
            <h2 style={{ fontWeight: 900, margin: '10px 0' }}>Order {placed.code} confirm liao!</h2>
            <p className="cl-muted" style={{ marginBottom: 8 }}>We assign a driver and collect at <b>{slot}</b>. Sit back and relax ah.</p>
            <p className="cl-muted" style={{ marginBottom: 24 }}>Total today: <b>{fmt.money(placed.total_cents)}</b></p>
            <button className="cl-btn cl-btn-lime" onClick={() => nav('/account')}>Track my order →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Steps({ step }) {
  const labels = ['Items', 'Slot', 'Review', 'Done'];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 26, justifyContent: 'center' }}>
      {labels.map((l, i) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 28, background: step >= i + 1 ? 'var(--navy)' : 'var(--gray3)', color: step >= i + 1 ? 'var(--lime)' : 'var(--gray)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: step >= i + 1 ? 'var(--navy)' : 'var(--gray2)' }}>{l}</span>
          {i < labels.length - 1 && <span style={{ width: 30, height: 2, background: 'var(--gray3)' }} />}
        </div>
      ))}
    </div>
  );
}

function CartSummary({ items, catalog, onNext, canNext, nextLabel, hideCta }) {
  const lines = items.map((it) => {
    const c = catalog.find((x) => x.id === it.catalog_id);
    const qty = c?.unit === 'per_kg' ? `${it.weight_kg}kg` : `×${it.qty}`;
    const price = c?.unit === 'per_kg' ? Math.round(c.price_cents * (it.weight_kg || 0)) : (c?.price_cents || 0) * (it.qty || 1);
    return { name: c?.name, qty, price, icon: c?.icon };
  });
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  return (
    <div className="panel" style={{ position: 'sticky', top: 92 }}>
      <div className="cl-eyebrow" style={{ marginBottom: 12 }}>Your bag</div>
      {lines.length === 0 ? <p className="cl-muted" style={{ fontSize: 14 }}>No items yet — add from the list.</p> :
        lines.map((l, i) => (
          <div key={i} className="cl-between" style={{ padding: '8px 0', fontSize: 14 }}>
            <span>{l.icon} {l.name} <span className="cl-muted">{l.qty}</span></span><b>{fmt.money(l.price)}</b>
          </div>
        ))}
      {lines.length > 0 && <><div className="cl-divider" /><div className="cl-between"><span className="cl-muted">Subtotal</span><b>{fmt.money(subtotal)}</b></div><div className="cl-muted" style={{ fontSize: 12, marginTop: 6 }}>+ platform fee, plan discounts & credit applied at review.</div></>}
      {!hideCta && <button className="cl-btn cl-btn-lime" style={{ marginTop: 18 }} disabled={!canNext} onClick={onNext}>{nextLabel} →</button>}
    </div>
  );
}

function Stepper({ value, step, unit, onChange }) {
  const b = { width: 34, height: 34, borderRadius: 34, background: 'var(--gray3)', fontSize: 18, fontWeight: 800, color: 'var(--navy)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button style={b} onClick={() => onChange(Math.max(0, +(value - step).toFixed(1)))}>−</button>
      <span style={{ minWidth: 48, textAlign: 'center', fontWeight: 800 }}>{value || 0}{unit && value ? unit : ''}</span>
      <button style={{ ...b, background: 'var(--navy)', color: '#fff' }} onClick={() => onChange(+(value + step).toFixed(1))}>+</button>
    </div>
  );
}

function Row({ l, v, green }) {
  return <div className="cl-between" style={{ padding: '5px 0' }}><span className="cl-muted">{l}</span><span style={{ color: green ? 'var(--ok)' : 'inherit', fontWeight: green ? 700 : 500 }}>{v}</span></div>;
}
