import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt, Button } from '@shared';
import WebServicePicker from './ServicePicker.jsx';

export default function Prices() {
  const nav = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [cart, setCart] = useState({});
  useEffect(() => { api.get('/api/catalog').then(setCatalog); }, []);

  if (!catalog) return <div className="app-page"><div className="web-wrap">Loading…</div></div>;

  const selected = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0);
  const totalCents = selected.reduce((sum, [id, v]) => {
    const c = catalog.find((x) => x.id === id);
    return sum + (c ? c.price_cents * (v.qty || v.weight || 0) : 0);
  }, 0);
  const book = () => nav('/order');

  return (
    <div className="app-page">
      <div className="web-wrap" style={{ maxWidth: 1040 }}>
        <h1 style={{ fontWeight: 900, fontSize: 34, marginBottom: 4 }}>Prices &amp; services</h1>
        <p className="cl-muted" style={{ marginBottom: 26 }}>Straightforward pricing, no surprises. Wash &amp; Fold by weight; everything else per item.</p>

        <div className="two-col">
          <div>
            <WebServicePicker catalog={catalog} cart={cart} setCart={setCart} />
          </div>

          <div className="panel" style={{ position: 'sticky', top: 90 }}>
            <div className="cl-eyebrow" style={{ marginBottom: 12 }}>Your estimate</div>
            {selected.length === 0
              ? <p className="cl-muted" style={{ fontSize: 14, marginBottom: 16 }}>Pick a Wash &amp; Fold bundle or add items to see a price — no minimum order.</p>
              : <div className="cl-between" style={{ marginBottom: 16 }}>
                  <span className="cl-muted" style={{ fontSize: 14 }}>Estimated</span>
                  <b style={{ fontSize: 22 }}>{fmt.money(totalCents)}</b>
                </div>}
            <Button variant="lime" onClick={book} style={{ width: '100%' }}>Book now →</Button>
            <div className="cl-row" style={{ gap: 8, marginTop: 16, justifyContent: 'center' }}>
              <span className="lh-stars" style={{ fontSize: 14 }}>★★★★★</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Rated Excellent</span>
            </div>
            <div style={{ borderTop: '1px solid var(--gray3)', marginTop: 16, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['48h turnaround', 'Free collection & delivery', 'No minimum order'].map((t) => (
                <span key={t} className="cl-row" style={{ gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 18, background: 'var(--lime)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</span>{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
