import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, fmt, PlacesAutocomplete, HANDOVER, ADDRESS_TYPES, REPEAT_CADENCE, Card, Button, Chip, CATEGORY_CHIPS, CATEGORY_DESC, etaLabel, PaymentSheet } from '@shared';
import { customerId } from '../auth.js';

const CUSTOMER_ID = customerId();

export default function Order() {
  const nav = useNavigate();
  const location = useLocation();
  const [skipItemStep] = useState(() => !!(location.state?.cart && Object.keys(location.state.cart).length));
  const [step, setStep] = useState(() => (skipItemStep ? 2 : 1));
  const [catalog, setCatalog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cart, setCart] = useState(() => location.state?.cart || {});
  const [slot, setSlot] = useState('Today · 18:00–20:00');
  const [useCredit, setUseCredit] = useState(true);
  const [quote, setQuote] = useState(null);
  const [placed, setPlaced] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');
  const [handover, setHandover] = useState('hand_to_me');
  const [handoverContact, setHandoverContact] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [repeatCadence, setRepeatCadence] = useState('weekly');
  const [noteOpen, setNoteOpen] = useState({});
  const [tipCents, setTipCents] = useState(0);
  const [chargesInfoOpen, setChargesInfoOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [upsellPlan, setUpsellPlan] = useState(null);
  const [payPlan, setPayPlan] = useState(null);

  useEffect(() => {
    api.get('/api/catalog').then(setCatalog);
    api.get('/api/plans').then(setPlans);
    api.get(`/api/customers/${CUSTOMER_ID}/summary`).then((s) => {
      setSummary(s); setAddresses(s.addresses || []);
      setAddrId((s.addresses?.find((a) => a.is_default) || s.addresses?.[0])?.id || null);
    });
  }, []);

  const [pendingPlace, setPendingPlace] = useState(null);
  const [addrType, setAddrType] = useState('home');
  const [addrLabel, setAddrLabel] = useState('');

  const saveAddress = async () => {
    const a = await api.post(`/api/customers/${CUSTOMER_ID}/addresses`, {
      type: addrType, label: (addrLabel.trim() || ADDRESS_TYPES[addrType].label),
      line1: pendingPlace.line1, line2: '', city: 'Singapore', postcode: pendingPlace.postcode, lat: pendingPlace.lat, lng: pendingPlace.lng, make_default: true,
    });
    setAddresses((list) => [...list, a]); setAddrId(a.id); setAdding(false); setPendingPlace(null); setAddrType('home'); setAddrLabel('');
  };

  const items = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0)
    .map(([catalog_id, v]) => ({ catalog_id, qty: v.qty, weight_kg: v.weight }));

  useEffect(() => {
    if (step === 3 && items.length) api.post('/api/orders/quote', { customer_id: CUSTOMER_ID, items, use_credit: useCredit }).then(setQuote);
    // eslint-disable-next-line
  }, [step, useCredit]);

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  const itemNotes = Object.entries(cart).filter(([, v]) => v.note?.trim()).map(([cid, v]) => `${catalog.find((c) => c.id === cid)?.name}: ${v.note.trim()}`);
  const combinedNotes = [notes.trim(), ...itemNotes].filter(Boolean).join(' · ');

  const place = async () => {
    setPlacing(true);
    const o = await api.post('/api/orders', { customer_id: CUSTOMER_ID, address_id: addrId, items, pickup_slot: slot, return_slot: 'Thu · 18:00–20:00', use_credit: useCredit, notes: combinedNotes, handover, handover_contact: handover === 'someone_else' ? handoverContact : null, repeat_requested: repeat, repeat_cadence: repeat ? repeatCadence : null, tip_cents: tipCents });
    setPlacing(false); setPlaced(o); setStep(4);
  };

  const activatePlan = (plan_id) => api.post(`/api/customers/${CUSTOMER_ID}/subscription`, { plan_id });
  const placeWithUpsell = async () => {
    if (upsellPlan) {
      const plan = plans.find((p) => p.id === upsellPlan);
      if (plan?.price_cents) { setPayPlan(plan); return; }
      await activatePlan(upsellPlan);
    }
    await place();
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
                const added = (c.unit === 'per_kg' ? v.weight : v.qty) > 0;
                return (
                  <Card key={c.id} style={{ marginBottom: 12, background: added ? 'var(--lime-pale)' : '#fff', border: added ? '1.5px solid var(--lime-d)' : '1.5px solid transparent' }}>
                    <div className="cl-between" style={{ alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 28 }}>{c.icon}</span>
                        <div><div style={{ fontWeight: 800 }}>{c.name}</div><div className="cl-muted" style={{ fontSize: 13 }}>From {fmt.money(c.price_cents)} Price per {c.unit === 'per_kg' ? 'kg' : 'item'}</div></div>
                      </div>
                      {!added
                        ? <Button sm variant="ghost" onClick={() => setItem(c.id, c.unit === 'per_kg' ? { weight: 1 } : { qty: 1 })} style={{ whiteSpace: 'nowrap' }}>+ Add</Button>
                        : <Button sm variant="navy" onClick={() => setItem(c.id, c.unit === 'per_kg' ? { weight: 0 } : { qty: 0 })} style={{ whiteSpace: 'nowrap' }}>✓ Added</Button>}
                    </div>
                    <div className="cl-row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      {(CATEGORY_CHIPS[c.category] || []).map((t) => <Chip key={t} variant="gray">{t}</Chip>)}
                    </div>
                    <div className="cl-between" style={{ marginTop: 8, alignItems: 'flex-end' }}>
                      <div className="cl-muted" style={{ fontSize: 13, maxWidth: 420 }}>{CATEGORY_DESC[c.category]}</div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}>{etaLabel(c.eta_hours)}</span>
                    </div>

                    {added && <>
                      <div className="cl-between" style={{ marginTop: 14 }}>
                        {c.unit === 'per_kg'
                          ? <Stepper value={v.weight || 0} step={0.5} unit="kg" onChange={(weight) => setItem(c.id, { weight })} />
                          : <Stepper value={v.qty || 0} step={1} onChange={(qty) => setItem(c.id, { qty })} />}
                        <button onClick={() => setNoteOpen((s) => ({ ...s, [c.id]: !s[c.id] }))} style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Any special requests?</button>
                      </div>
                      {noteOpen[c.id] && (
                        <input className="cl-field" style={{ marginTop: 10, width: '100%' }} placeholder={`Notes for ${c.name}…`}
                          value={v.note || ''} onChange={(e) => setItem(c.id, { note: e.target.value })} />
                      )}
                    </>}
                  </Card>
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
              {adding && <div style={{ marginBottom: 12, padding: 16, borderRadius: 12, background: 'var(--light)' }}>
                {!pendingPlace ? (
                  <PlacesAutocomplete autoFocus onSelect={setPendingPlace} placeholder="e.g. Tiong Bahru, 168732, ION Orchard…" />
                ) : <>
                  <div className="cl-between" style={{ marginBottom: 12 }}>
                    <div><b>📍 {pendingPlace.name}</b><div className="cl-muted" style={{ fontSize: 14 }}>{pendingPlace.line1} · {pendingPlace.postcode}</div></div>
                    <button onClick={() => setPendingPlace(null)} style={{ fontWeight: 700, color: 'var(--navy)' }}>Change</button>
                  </div>
                  <div className="cl-label">Address type</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {Object.entries(ADDRESS_TYPES).map(([k, t]) => (
                      <button key={k} onClick={() => setAddrType(k)} style={{ flex: 1, padding: '10px 0', borderRadius: 11, fontWeight: 700, fontSize: 14, border: addrType === k ? '2px solid var(--navy)' : '1.5px solid var(--gray3)', background: addrType === k ? 'var(--navy)' : '#fff', color: addrType === k ? '#fff' : 'var(--gray)' }}>{t.icon} {t.label}</button>
                    ))}
                  </div>
                  {addrType === 'other' && <input className="cl-field" placeholder="Label (e.g. Mum's place, Gym)" value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />}
                  <button className="cl-btn cl-btn-lime" onClick={saveAddress}>Save address</button>
                </>}
              </div>}
              {addresses.map((a) => (
                <div key={a.id} onClick={() => setAddrId(a.id)} className="cl-between" style={{ padding: 16, borderRadius: 12, marginBottom: 10, cursor: 'pointer', border: addrId === a.id ? '2px solid var(--navy)' : '2px solid var(--gray3)' }}>
                  <div><b>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label}</b><div className="cl-muted" style={{ fontSize: 14 }}>{a.line1}, {a.city} {a.postcode}</div></div>
                  {addrId === a.id && <span>✓</span>}
                </div>
              ))}
              <div style={{ margin: '22px 0 10px' }}>
                <h3 style={{ fontWeight: 800 }}>How should we collect?</h3>
              </div>
              {Object.entries(HANDOVER).map(([key, h]) => (
                <div key={key} onClick={() => setHandover(key)} className="cl-between" style={{ padding: 16, borderRadius: 12, marginBottom: 10, cursor: 'pointer', border: handover === key ? '2px solid var(--navy)' : '2px solid var(--gray3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{h.icon}</span>
                    <div><b>{h.label}</b><div className="cl-muted" style={{ fontSize: 14 }}>{h.sub}</div></div>
                  </div>
                  {handover === key && <span>✓</span>}
                </div>
              ))}
              {handover === 'someone_else' && (
                <input className="cl-field" placeholder="Their name & phone (e.g. Mum · 9123 4567)" value={handoverContact} onChange={(e) => setHandoverContact(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
              )}
              <div style={{ margin: '22px 0 10px' }}>
                <h3 style={{ fontWeight: 800 }}>Special Instructions / Garment Notes</h3>
              </div>
              <textarea className="cl-field" rows={3} placeholder="E.g., 2 Oxford shirts (White/Blue), tumble dry low for chinos..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', marginBottom: 12, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                <button className="cl-btn cl-btn-ghost" style={{ width: 'auto' }} onClick={() => (skipItemStep ? nav('/prices') : setStep(1))}>← Back</button>
                <button className="cl-btn cl-btn-lime" style={{ width: 'auto' }} disabled={!addrId} onClick={() => setStep(3)}>Review order →</button>
              </div>
            </div>
            <CartSummary items={items} catalog={catalog} hideCta />
          </div>
        )}

        {step === 3 && (
          <div className="two-col">
            <div className="panel">
              <h2 style={{ fontWeight: 900, marginBottom: 16 }}>Pay now (incl. tax)</h2>
              {!quote ? <p>Calculating…</p> : <>
                <Row l="Subtotal" v={fmt.money(quote.subtotal_cents)} />
                <Row l="Service fee" v={quote.platform_fee_cents ? fmt.money(quote.platform_fee_cents) : 'WAIVED'} />
                <Row l="Collection & Delivery" v={quote.delivery_fee_cents ? fmt.money(quote.delivery_fee_cents) : 'FREE'} />
                {quote.credit_applied_cents > 0 && <Row l="Wallet credit" v={`– ${fmt.money(quote.credit_applied_cents)}`} green />}
                {tipCents > 0 && <Row l="Driver tip" v={fmt.money(tipCents)} />}
                <button onClick={() => setChargesInfoOpen((x) => !x)} style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginTop: 8 }}>How charges work?</button>
                {chargesInfoOpen && (
                  <div className="cl-muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                    Priced per kg or item at checkout. The service fee covers collection & delivery — waived automatically on Plus/Pro. Wallet credit is applied before your card is charged.
                  </div>
                )}
                <div className="cl-divider" />
                <Row l={<b style={{ fontSize: 18 }}>Total today</b>} v={<b style={{ fontSize: 18 }}>{fmt.money(quote.total_cents + tipCents)}</b>} />

                <label className="cl-between" style={{ marginTop: 16, cursor: 'pointer' }} onClick={() => setUseCredit((x) => !x)}>
                  <span style={{ fontWeight: 700 }}>Use wallet credit ({fmt.money(summary?.balance_cents || 0)})</span>
                  <span style={{ width: 44, height: 26, borderRadius: 999, background: useCredit ? 'var(--lime)' : 'var(--gray3)', position: 'relative' }}><span style={{ position: 'absolute', top: 3, left: useCredit ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff' }} /></span>
                </label>

                <div style={{ marginTop: 20 }}>
                  <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Tip your driver?</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[0, 200, 400, 1000].map((amt) => (
                      <button key={amt} type="button" onClick={() => setTipCents(amt)} className={`cl-btn cl-btn-sm ${tipCents === amt ? 'cl-btn-lime' : 'cl-btn-ghost'}`} style={{ width: 'auto', flex: 1 }}>{amt === 0 ? 'No' : fmt.money(amt)}</button>
                    ))}
                  </div>
                </div>

                <label className="cl-between" style={{ marginTop: 20, cursor: 'pointer' }} onClick={() => setRepeat((x) => !x)}>
                  <span style={{ fontWeight: 700 }}>🔁 Repeat this order</span>
                  <span style={{ width: 44, height: 26, borderRadius: 999, background: repeat ? 'var(--lime)' : 'var(--gray3)', position: 'relative' }}><span style={{ position: 'absolute', top: 3, left: repeat ? 21 : 3, width: 20, height: 20, borderRadius: 20, background: '#fff' }} /></span>
                </label>
                {repeat && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {Object.entries(REPEAT_CADENCE).map(([k, c]) => (
                      <button key={k} type="button" onClick={() => setRepeatCadence(k)} className={`cl-btn cl-btn-sm ${repeatCadence === k ? 'cl-btn-lime' : 'cl-btn-ghost'}`} style={{ width: 'auto', flex: 1 }}>{c.label}</button>
                    ))}
                  </div>
                )}

                {!summary?.subscription && plans.filter((p) => p.price_cents > 0).map((p) => (
                  <Card key={p.id} onClick={() => setUpsellPlan((x) => (x === p.id ? null : p.id))}
                    style={{ marginTop: 14, cursor: 'pointer', border: upsellPlan === p.id ? '2px solid var(--navy)' : '2px solid transparent' }}>
                    <div className="cl-row" style={{ gap: 12 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 20, border: '2px solid var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {upsellPlan === p.id && <span style={{ width: 10, height: 10, borderRadius: 10, background: 'var(--navy)' }} />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div className="cl-between"><b>ChaseLaundry {p.name}</b><span style={{ fontWeight: 800 }}>{fmt.money(p.price_cents)}/mo</span></div>
                        <div className="cl-muted" style={{ fontSize: 13, marginTop: 2 }}>{p.perks[0]}</div>
                      </div>
                    </div>
                  </Card>
                ))}

                <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                  <button className="cl-btn cl-btn-ghost" style={{ width: 'auto' }} onClick={() => setStep(2)}>← Back</button>
                  <button className="cl-btn cl-btn-lime" style={{ width: 'auto' }} disabled={placing} onClick={placeWithUpsell}>{placing ? 'Placing…' : `Pay now ${fmt.money(quote.total_cents + tipCents)}`}</button>
                </div>

                <PaymentSheet open={!!payPlan} onClose={() => setPayPlan(null)} amountCents={payPlan?.price_cents || 0}
                  recurring cta="Subscribe & pay" title={payPlan ? `Subscribe to ${payPlan.name}` : ''} description={payPlan ? `${payPlan.name} plan` : ''}
                  onAuthorized={async () => { await activatePlan(payPlan.id); setPayPlan(null); await place(); }} />
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
