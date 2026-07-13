import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt, Chip, Button, CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_CHIPS, CATEGORY_DESC, CATEGORY_INFO, CATEGORY_TINT, etaLabel } from '@shared';

function Stepper({ value, step, unit, onChange }) {
  return (
    <div className="cl-row" style={{ gap: 10 }}>
      <button onClick={() => onChange(Math.max(0, +(value - step).toFixed(1)))} style={stepBtn}>−</button>
      <span style={{ minWidth: 44, textAlign: 'center', fontWeight: 800 }}>{value || 0}{unit && value ? unit : ''}</span>
      <button onClick={() => onChange(+(value + step).toFixed(1))} style={{ ...stepBtn, background: 'var(--navy)', color: '#fff' }}>+</button>
    </div>
  );
}
const stepBtn = { width: 32, height: 32, borderRadius: 32, background: 'var(--gray3)', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)' };

export default function Prices() {
  const nav = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [active, setActive] = useState(null); // category key, or null for the list view
  const [infoOpen, setInfoOpen] = useState(false);
  const [cart, setCart] = useState({}); // catalogId -> { qty, weight }
  useEffect(() => { api.get('/api/catalog').then(setCatalog); }, []);
  useEffect(() => { setInfoOpen(false); }, [active]);

  if (!catalog) return <div className="app-page"><div className="web-wrap">Loading…</div></div>;

  const categories = CATEGORY_ORDER.filter((k) => catalog.some((c) => c.category === k));
  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const selected = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0);
  const totalCents = selected.reduce((sum, [id, v]) => {
    const c = catalog.find((x) => x.id === id);
    return sum + (c ? c.price_cents * (v.qty || v.weight || 0) : 0);
  }, 0);
  const goBook = () => nav('/order', { state: selected.length ? { cart } : undefined });

  return (
    <div className="app-page">
      <div className="web-wrap" style={{ maxWidth: 980 }}>
        {!active ? (
          <>
            <h1 style={{ fontWeight: 900, fontSize: 34, marginBottom: 24 }}>Prices</h1>
            {categories.map((cat) => {
              const items = catalog.filter((c) => c.category === cat);
              const maxEta = Math.max(...items.map((c) => c.eta_hours));
              return (
                <div key={cat} className="panel" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => setActive(cat)}>
                  <div className="cl-row" style={{ gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 48, background: CATEGORY_TINT[cat], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{items[0].icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{CATEGORY_LABEL[cat]}</div>
                      <div className="cl-muted" style={{ fontSize: 14, marginTop: 2 }}>{CATEGORY_DESC[cat]}</div>
                      {maxEta >= 72 && <div className="cl-muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>🕐 {etaLabel(maxEta).toUpperCase()}</div>}
                    </div>
                    <span style={{ color: 'var(--gray2)', fontSize: 20, flexShrink: 0 }}>›</span>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <a onClick={() => setActive(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--navy)', marginBottom: 16, cursor: 'pointer' }}>‹ Service list</a>
            <div className="cl-row" style={{ gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {categories.map((k) => (
                <button key={k} onClick={() => setActive(k)} style={{
                  padding: '10px 18px', borderRadius: 999, fontWeight: 800, fontSize: 13, letterSpacing: '.3px',
                  background: active === k ? 'var(--navy)' : 'var(--gray3)', color: active === k ? '#fff' : 'var(--gray)',
                }}>{CATEGORY_LABEL[k].toUpperCase()}</button>
              ))}
            </div>
            <div className="two-col">
              <div>
                {catalog.filter((c) => c.category === active).map((c) => {
                  const v = cart[c.id] || {};
                  const added = (c.unit === 'per_kg' ? v.weight : v.qty) > 0;
                  return (
                    <div key={c.id} className="panel" style={{ marginBottom: 14, background: added ? 'var(--lime-pale)' : '#fff', border: added ? '1.5px solid var(--lime-d)' : '1.5px solid transparent' }}>
                      <div className="cl-between">
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{c.name}</div>
                          <div className="cl-muted" style={{ fontSize: 13, marginTop: 4 }}>{CATEGORY_DESC[c.category]}</div>
                          <div style={{ fontWeight: 900, fontSize: 15, marginTop: 8 }}>
                            {fmt.money(c.price_cents)} <span className="cl-muted" style={{ fontWeight: 600, fontSize: 13 }}>/ {c.unit === 'per_kg' ? 'kg' : 'item'}</span>
                          </div>
                        </div>
                        {!added
                          ? <button className="cl-btn cl-btn-ghost cl-btn-sm" style={{ width: 'auto', background: '#fff', border: '1.5px solid var(--navy)', color: 'var(--navy)' }} onClick={() => setItem(c.id, c.unit === 'per_kg' ? { weight: 1 } : { qty: 1 })}>+ Add</button>
                          : <Stepper value={c.unit === 'per_kg' ? (v.weight || 0) : (v.qty || 0)} step={c.unit === 'per_kg' ? 0.5 : 1} unit={c.unit === 'per_kg' ? 'kg' : ''} onChange={(val) => setItem(c.id, c.unit === 'per_kg' ? { weight: val } : { qty: val })} />}
                      </div>
                    </div>
                  );
                })}
                {catalog.find((c) => c.category === active)?.unit === 'per_kg' && (
                  <div className="panel" style={{ background: 'var(--lime-pale)' }}>
                    <b>No minimum order</b>
                    <p className="cl-muted" style={{ fontSize: 13, marginTop: 6 }}>Priced continuously per kg, so you only ever pay for what you send — no fixed bundle sizes.</p>
                  </div>
                )}
              </div>
              <div className="panel" style={{ position: 'sticky', top: 90 }}>
                <div className="cl-between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                  <div className="cl-row" style={{ gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{catalog.find((c) => c.category === active)?.icon}</span>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>{CATEGORY_LABEL[active]}</div>
                  </div>
                  <a onClick={() => setInfoOpen((x) => !x)} style={{ fontWeight: 700, color: 'var(--navy)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>{infoOpen ? 'Show less' : 'Learn more'}</a>
                </div>
                <p className="cl-muted" style={{ fontSize: 14, marginBottom: 12 }}>{CATEGORY_DESC[active]}</p>
                {infoOpen && <p className="cl-muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>{CATEGORY_INFO[active]}</p>}
                <div className="cl-row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                  {(CATEGORY_CHIPS[active] || []).map((t) => <Chip key={t} variant="gray">{t}</Chip>)}
                </div>
                {selected.length > 0 && (
                  <>
                    <div className="cl-divider" />
                    <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Your bag</div>
                    {selected.map(([id, v]) => {
                      const c = catalog.find((x) => x.id === id);
                      if (!c) return null;
                      return <div key={id} className="cl-between" style={{ fontSize: 13, padding: '4px 0' }}><span>{c.name} {v.weight_kg || v.weight ? `· ${v.weight}kg` : v.qty > 1 ? `× ${v.qty}` : ''}</span><span>{fmt.money(c.price_cents * (v.qty || v.weight || 0))}</span></div>;
                    })}
                    <div className="cl-between" style={{ marginTop: 6, marginBottom: 16 }}><b>Estimated</b><b>{fmt.money(totalCents)}</b></div>
                  </>
                )}
                <Button variant="lime" disabled={!selected.length} onClick={goBook} style={{ width: '100%', marginTop: selected.length ? 0 : 8 }}>{selected.length ? 'Schedule a collection' : 'Book now'}</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
