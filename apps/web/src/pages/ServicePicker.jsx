import React, { useEffect, useMemo, useState } from 'react';
import {
  fmt, Chip, Button, CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_CHIPS, CATEGORY_DESC, CATEGORY_INFO, CATEGORY_TINT, etaLabel,
} from '@shared';

// Laundryheap-style service picker for the web app: service tabs → info header →
// Wash & Fold weight bundles / grouped per-item pricelist. Shared by the Prices
// page and the booking flow's "what needs cleaning" step.
export default function WebServicePicker({ catalog, cart, setCart, initialCat }) {
  const [cat, setCat] = useState(() => initialCat || 'wash_fold');
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => { setInfoOpen(false); }, [cat]);

  const categories = useMemo(() => CATEGORY_ORDER.filter((k) => catalog.some((c) => c.category === k)), [catalog]);
  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const items = catalog.filter((c) => c.category === cat);
  const headIcon = items[0]?.icon || '🧺';

  if (!catalog.length) return <p className="cl-muted">Loading…</p>;

  return (
    <>
      {/* service tabs — Wash & Fold first / main */}
      <div className="cl-row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {categories.map((k) => (
          <button key={k} onClick={() => setCat(k)} style={{
            padding: '10px 18px', borderRadius: 999, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap',
            background: cat === k ? 'var(--navy)' : '#fff', color: cat === k ? '#fff' : 'var(--gray)',
            boxShadow: cat === k ? 'none' : 'var(--shadow-sm)',
          }}>{CATEGORY_LABEL[k]}</button>
        ))}
      </div>

      {/* service info header */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="cl-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="cl-row" style={{ gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 52, background: CATEGORY_TINT[cat], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{headIcon}</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{CATEGORY_LABEL[cat]}</div>
              <div className="cl-muted" style={{ fontSize: 14, marginTop: 2 }}>{CATEGORY_DESC[cat]}</div>
            </div>
          </div>
          <a onClick={() => setInfoOpen((x) => !x)} style={{ fontWeight: 800, color: 'var(--navy)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>{infoOpen ? 'Less' : 'Learn more'}</a>
        </div>
        <div className="cl-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {(CATEGORY_CHIPS[cat] || []).map((t, i, a) => (
            <React.Fragment key={t}>
              <Chip variant="gray">{t}</Chip>
              {i < a.length - 1 && <span style={{ color: 'var(--gray2)', fontWeight: 800 }}>+</span>}
            </React.Fragment>
          ))}
        </div>
        {infoOpen && <p className="cl-muted" style={{ fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>{CATEGORY_INFO[cat]}</p>}
      </div>

      {cat === 'wash_fold'
        ? <WashFoldBundles items={items} cart={cart} setItem={setItem} />
        : <ItemGroups items={items} cart={cart} setItem={setItem} />}
    </>
  );
}

// Wash & Fold — weight bundles (Mixed 6kg / Separate 12kg) + additional kg.
function WashFoldBundles({ items, cart, setItem }) {
  const base = items.find((c) => /fold/i.test(c.name)) || items[0];
  if (!base) return null;
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
          <div key={b.key} className="panel" onClick={() => pick(b.kg)}
            style={{ marginBottom: 14, cursor: 'pointer', border: on ? '2px solid var(--navy)' : '2px solid transparent', background: on ? 'var(--lime-pale)' : '#fff' }}>
            <div className="cl-between" style={{ gap: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{b.name}</div>
                <div className="cl-muted" style={{ fontSize: 14, marginTop: 3 }}>{b.desc}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 20 }}>{fmt.money(perKg * b.kg)}</div>
                <div className="cl-muted" style={{ fontSize: 13 }}>/ {b.kg}kg</div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="panel" style={{ marginBottom: 14, background: 'var(--lime-pale)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>What if I have more?</div>
        <p className="cl-muted" style={{ fontSize: 14, marginBottom: activeKg ? 14 : 0 }}>
          You can send as much as you need. Each additional kg costs {fmt.money(perKg)}.
        </p>
        {activeKg ? (
          <div className="cl-between">
            <span style={{ fontWeight: 700 }}>Additional weight</span>
            <Stepper value={extra} step={1} unit="kg" onChange={setExtra} />
          </div>
        ) : null}
      </div>

      <div className="panel" style={{ background: 'var(--light)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>See what 6kg looks like</div>
        <div className="cl-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {['12 shirts', '3 trousers', '7 underwear', '7 pairs of socks'].map((t) => <Chip key={t} variant="gray">{t}</Chip>)}
        </div>
      </div>
    </>
  );
}

// Per-item pricelist grouped by garment type, with group sub-tabs.
function ItemGroups({ items, cart, setItem }) {
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
  const addedIn = (g) => items.filter((c) => (c.grp || 'All') === g && (cart[c.id]?.qty || 0) > 0).length;

  return (
    <>
      {groups.length > 1 && (
        <div className="cl-row" style={{ gap: 22, marginBottom: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--gray3)', paddingBottom: 2 }}>
          {groups.map((g) => {
            const on = g === grp, n = addedIn(g);
            return (
              <button key={g} onClick={() => setGrp(g)} style={{
                padding: '4px 0 10px', fontWeight: on ? 800 : 600, fontSize: 15, whiteSpace: 'nowrap',
                color: on ? 'var(--navy)' : 'var(--gray2)', borderBottom: on ? '2px solid var(--navy)' : '2px solid transparent',
              }}>{g}{n > 0 ? ` · ${n}` : ''}</button>
            );
          })}
        </div>
      )}
      <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 12 }}>{grp}</div>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {shown.map((c, i) => {
          const qty = cart[c.id]?.qty || 0;
          return (
            <div key={c.id} className="cl-between" style={{ padding: '16px 20px', borderBottom: i < shown.length - 1 ? '1px solid var(--gray3)' : 'none', gap: 14, background: qty > 0 ? 'var(--lime-pale)' : '#fff' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>{etaLabel(c.eta_hours)}</div>
              </div>
              <div className="cl-row" style={{ gap: 14, flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{fmt.money(c.price_cents)}</span>
                {qty > 0
                  ? <Stepper value={qty} step={1} onChange={(q) => setItem(c.id, { qty: q })} />
                  : <Button sm variant="ghost" onClick={() => setItem(c.id, { qty: 1 })}>+ Add</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Stepper({ value, step, unit, onChange }) {
  const b = { width: 34, height: 34, borderRadius: 34, background: 'var(--gray3)', fontSize: 18, fontWeight: 800, color: 'var(--navy)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button style={b} onClick={() => onChange(Math.max(0, +(value - step).toFixed(1)))}>−</button>
      <span style={{ minWidth: 48, textAlign: 'center', fontWeight: 800 }}>{value || 0}{unit && value ? unit : ''}</span>
      <button style={{ ...b, background: 'var(--navy)', color: '#fff' }} onClick={() => onChange(+(value + step).toFixed(1))}>+</button>
    </div>
  );
}
