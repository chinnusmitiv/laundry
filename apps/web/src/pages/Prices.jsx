import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt, Chip, Button, CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_CHIPS, CATEGORY_DESC, CATEGORY_INFO, CATEGORY_TINT, etaLabel } from '@shared';

export default function Prices() {
  const nav = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [active, setActive] = useState(null); // category key, or null for the list view
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => { api.get('/api/catalog').then(setCatalog); }, []);
  useEffect(() => { setInfoOpen(false); }, [active]);

  if (!catalog) return <div className="app-page"><div className="web-wrap">Loading…</div></div>;

  const categories = CATEGORY_ORDER.filter((k) => catalog.some((c) => c.category === k));

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
                {catalog.filter((c) => c.category === active).map((c) => (
                  <div key={c.id} className="panel" style={{ marginBottom: 14 }}>
                    <div className="cl-between">
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{c.name}</div>
                        <div className="cl-muted" style={{ fontSize: 13, marginTop: 4 }}>{CATEGORY_DESC[c.category]}</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: 'nowrap', marginLeft: 16 }}>
                        {fmt.money(c.price_cents)} <span className="cl-muted" style={{ fontWeight: 600, fontSize: 13 }}>/ {c.unit === 'per_kg' ? 'kg' : 'item'}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                <Button variant="lime" onClick={() => nav('/order')} style={{ width: '100%' }}>Book now</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
