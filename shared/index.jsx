import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getSocket, fmt, api } from './api.js';

export * from './api.js';

// ── Logo mark: the ChaseLaundry "C arc + dot" ──
export function Mark({ size = 40, stroke = '#C7FF33', dot = '#C7FF33' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M 82.34 62.51 A 34 34 0 1 1 68.02 23.17" stroke={stroke} strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="82.78" cy="32.00" r="6.0" fill={dot} />
    </svg>
  );
}

export function Logo({ size = 28, theme = 'dark', tagline = false }) {
  const isDark = theme === 'dark';
  const navy = '#1D2951', lime = '#C7FF33';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Mark size={size * 1.3} stroke={isDark ? lime : navy} dot={lime} />
      <div>
        <div style={{ fontSize: size, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1, color: isDark ? '#fff' : navy }}>
          Chase<span style={{ color: isDark ? lime : '#A8D400' }}>Laundry</span>
        </div>
        {tagline && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,.4)' : 'rgba(29,41,81,.4)', marginTop: 4 }}>More Life. Less Laundry.</div>}
      </div>
    </div>
  );
}

// ── UI primitives ──
export function Button({ children, variant = 'navy', sm, style, ...p }) {
  const cls = `cl-btn ${variant === 'lime' ? 'cl-btn-lime' : variant === 'ghost' ? 'cl-btn-ghost' : ''} ${sm ? 'cl-btn-sm' : ''}`;
  return <button className={cls} style={style} {...p}>{children}</button>;
}

export function Card({ children, style, onClick }) {
  return <div className="cl-card" style={style} onClick={onClick}>{children}</div>;
}

export function Chip({ children, variant }) {
  const cls = `cl-chip ${variant === 'navy' ? 'cl-chip-navy' : variant === 'gray' ? 'cl-chip-gray' : ''}`;
  return <span className={cls}>{children}</span>;
}

export function Field({ label, ...p }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      {label && <span className="cl-label">{label}</span>}
      <input className="cl-field" {...p} />
    </label>
  );
}

export function Avatar({ name, color = '#1D2951', size = 38 }) {
  const initials = name ? name.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?';
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: color, color: '#C7FF33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// status pill with colour by stage
const STATUS_COLOR = {
  placed: '#9CA3AF', assigned: '#6366F1', driver_en_route: '#3B82F6', picked_up: '#3B82F6',
  at_facility: '#8B5CF6', processing: '#8B5CF6', ready: '#10B981',
  out_for_delivery: '#F59E0B', delivered: '#16A34A', completed: '#16A34A', cancelled: '#EF4444',
};
export function StatusPill({ status, label }) {
  const c = STATUS_COLOR[status] || '#9CA3AF';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 999, background: `${c}1A`, color: c }}>
    <span style={{ width: 6, height: 6, borderRadius: 6, background: c }} />{label || status}
  </span>;
}

// app top bar (navy)
export function TopBar({ left, right, title, subtitle }) {
  return (
    <div style={{ background: 'var(--navy)', color: '#fff', padding: '18px 18px 16px', position: 'sticky', top: 0, zIndex: 20 }}>
      <div className="cl-between">
        <div>{left}{title && <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.5px' }}>{title}</div>}{subtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{subtitle}</div>}</div>
        {right}
      </div>
    </div>
  );
}

// bottom tab nav for mobile apps
export function BottomNav({ tabs, active, onChange }) {
  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 460, background: '#fff', borderTop: '1px solid var(--gray3)', display: 'flex', padding: '8px 4px 14px', zIndex: 30 }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', color: active === t.key ? 'var(--navy)' : 'var(--gray2)', position: 'relative' }}>
          <span style={{ fontSize: 21 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</span>
          {t.badge ? <span style={{ position: 'absolute', top: 0, right: '50%', marginRight: -18, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// bottom sheet / modal
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,64,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--light)', width: '100%', maxWidth: 460, borderRadius: '24px 24px 0 0', padding: 20, maxHeight: '92vh', overflowY: 'auto', animation: 'clUp .25s ease' }}>
        <div style={{ width: 40, height: 4, background: 'var(--gray3)', borderRadius: 4, margin: '0 auto 16px' }} />
        {title && <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>{title}</div>}
        {children}
      </div>
      <style>{`@keyframes clUp{from{transform:translateY(40px);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

// per-garment stage timeline (shared by customer app + website)
const GARMENT_STAGES = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];
const GARMENT_STAGE_LABEL = { checked_in: 'Checked in', washing: 'Washing', drying: 'Drying', ironing: 'Ironing', qc: 'Quality check', packed: 'Packed', returned: 'Returned' };
const GARMENT_STAGE_ICON = { checked_in: '🏷️', washing: '🫧', drying: '🌬️', ironing: '🔥', qc: '🔍', packed: '📦', returned: '✅' };

export function GarmentJourney({ garment, compact }) {
  const idx = GARMENT_STAGES.indexOf(garment.status);
  const eventByStatus = {};
  (garment.events || []).forEach((e) => { eventByStatus[e.status] = e; });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: compact ? 0 : 8 }}>
        {GARMENT_STAGES.map((s, i) => {
          const done = i <= idx;
          const cur = i === idx;
          return (
            <React.Fragment key={s}>
              <div title={GARMENT_STAGE_LABEL[s]} style={{
                width: 30, height: 30, borderRadius: 30, flexShrink: 0, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--lime)' : 'var(--gray3)', opacity: done ? 1 : 0.6,
                outline: cur ? '3px solid rgba(199,255,51,.35)' : 'none',
              }}>{GARMENT_STAGE_ICON[s]}</div>
              {i < GARMENT_STAGES.length - 1 && <div style={{ flex: 1, minWidth: 6, height: 2, background: i < idx ? 'var(--lime-d)' : 'var(--gray3)' }} />}
            </React.Fragment>
          );
        })}
      </div>
      {!compact && (
        <div style={{ marginTop: 6 }}>
          {(garment.events || []).slice().reverse().map((e) => (
            <div key={e.id} className="cl-between" style={{ fontSize: 12, padding: '3px 0' }}>
              <span style={{ fontWeight: 600 }}>{GARMENT_STAGE_ICON[e.status]} {GARMENT_STAGE_LABEL[e.status] || e.status}{e.actor === 'scan' ? ' · scanned' : ''}</span>
              <span className="cl-muted">{fmt.time(e.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Empty({ icon = '📭', title, sub }) {
  return <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--gray2)' }}>
    <div style={{ fontSize: 42, marginBottom: 10 }}>{icon}</div>
    <div style={{ fontWeight: 800, color: 'var(--gray)' }}>{title}</div>
    {sub && <div style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
  </div>;
}

// Google-Maps-style Singapore address autocomplete.
// Debounced search against /api/places/search; calls onSelect with the chosen place.
export function PlacesAutocomplete({ onSelect, placeholder = 'Search address or postcode…', autoFocus }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [loading, setLoading] = useState(false);
  const box = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onChange = (val) => {
    setQ(val); setOpen(true); setHi(0);
    clearTimeout(timer.current);
    if (val.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try { setResults(await api.get(`/api/places/search?q=${encodeURIComponent(val)}`)); }
      finally { setLoading(false); }
    }, 180);
  };

  const choose = (p) => { setQ(p.description); setOpen(false); setResults([]); onSelect?.(p); };
  const onKey = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>📍</span>
        <input className="cl-field" style={{ paddingLeft: 40 }} value={q} placeholder={placeholder} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} onFocus={() => q && setOpen(true)} onKeyDown={onKey} />
      </div>
      {open && (q.trim().length >= 2) && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(29,41,81,.18)', zIndex: 80, overflow: 'hidden', border: '1px solid var(--gray3)' }}>
          {loading && results.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--gray)' }}>Searching…</div>}
          {!loading && results.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--gray)' }}>No places found</div>}
          {results.map((p, i) => (
            <div key={p.postcode + p.name} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', cursor: 'pointer', background: i === hi ? 'var(--light)' : '#fff' }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray)' }}>{p.line1} · {p.area} {p.postcode}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: '6px 14px', fontSize: 10, color: 'var(--gray2)', borderTop: '1px solid var(--gray3)', textAlign: 'right' }}>Powered by ChaseLaundry Places 🇸🇬</div>
        </div>
      )}
    </div>
  );
}

// ── hooks ──
// subscribe to socket events; auto-cleanup. handlers = { event: fn }
export function useSocket(handlers, joinPayload, deps = []) {
  useEffect(() => {
    const s = getSocket();
    const onConnect = () => joinPayload && s.emit('join', joinPayload);
    s.on('connect', onConnect);
    if (s.connected && joinPayload) s.emit('join', joinPayload);
    const entries = Object.entries(handlers || {});
    for (const [ev, fn] of entries) s.on(ev, fn);
    return () => { s.off('connect', onConnect); for (const [ev, fn] of entries) s.off(ev, fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Real Singapore map using OneMap tiles (Singapore Land Authority) + Leaflet.
// Plots a destination pin and a live, pulsing driver marker; auto-fits both.
function driverDivIcon() {
  return L.divIcon({ className: 'cl-leaflet-icon', html: '<div class="cl-pulse"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
}
function pinDivIcon() {
  return L.divIcon({ className: 'cl-leaflet-icon', html: '<div class="cl-pin">📍</div>', iconSize: [28, 28], iconAnchor: [14, 28] });
}

export function OneMap({ driver, dest, height = 220 }) {
  const el = useRef(null);
  const map = useRef(null);
  const dMark = useRef(null);
  const destMark = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([1.3521, 103.8198], 12);
    L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
      detectRetina: true, maxZoom: 18, minZoom: 11,
      attribution: '&copy; <a href="https://www.onemap.gov.sg/">OneMap</a> &copy; Singapore Land Authority',
    }).addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 150);
    return () => { m.remove(); map.current = null; dMark.current = null; destMark.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const pts = [];
    if (dest && dest.lat) {
      const ll = [dest.lat, dest.lng];
      if (!destMark.current) destMark.current = L.marker(ll, { icon: pinDivIcon() }).addTo(m);
      else destMark.current.setLatLng(ll);
      pts.push(ll);
    }
    if (driver && driver.lat) {
      const ll = [driver.lat, driver.lng];
      if (!dMark.current) dMark.current = L.marker(ll, { icon: driverDivIcon(), zIndexOffset: 1000 }).addTo(m);
      else dMark.current.setLatLng(ll);
      pts.push(ll);
    }
    m.invalidateSize();
    if (pts.length === 1) m.setView(pts[0], 16, { animate: true });
    else if (pts.length > 1) m.fitBounds(pts, { padding: [44, 44], maxZoom: 16 });
  }, [driver?.lat, driver?.lng, dest?.lat, dest?.lng]);

  return <div ref={el} style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative', isolation: 'isolate', background: '#dde3f0' }} />;
}

// simple mini map (no external tiles) — plots driver + destination on a stylised grid
export function MiniMap({ driver, dest, height = 200 }) {
  // normalise lat/lng into the box
  const pts = [driver, dest].filter(Boolean);
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const pad = 0.004;
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
  const X = (lng) => ((lng - minLng) / (maxLng - minLng || 1)) * 100;
  const Y = (lat) => (1 - (lat - minLat) / (maxLat - minLat || 1)) * 100;
  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg,#1D2951,#253470)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {[20, 40, 60, 80].map((g) => <line key={`h${g}`} x1="0" y1={g} x2="100" y2={g} stroke="rgba(199,255,51,.07)" strokeWidth=".4" />)}
        {[20, 40, 60, 80].map((g) => <line key={`v${g}`} x1={g} y1="0" x2={g} y2="100" stroke="rgba(199,255,51,.07)" strokeWidth=".4" />)}
        {driver && dest && <line x1={X(driver.lng)} y1={Y(driver.lat)} x2={X(dest.lng)} y2={Y(dest.lat)} stroke="#C7FF33" strokeWidth="1" strokeDasharray="3 2" opacity=".7" />}
        {dest && <g><circle cx={X(dest.lng)} cy={Y(dest.lat)} r="3" fill="#fff" /><circle cx={X(dest.lng)} cy={Y(dest.lat)} r="6" fill="none" stroke="#fff" strokeWidth=".6" opacity=".5" /></g>}
        {driver && <g style={{ transition: 'all .8s ease' }}><circle cx={X(driver.lng)} cy={Y(driver.lat)} r="4" fill="#C7FF33" /><circle cx={X(driver.lng)} cy={Y(driver.lat)} r="8" fill="#C7FF33" opacity=".25"><animate attributeName="r" values="5;10;5" dur="1.8s" repeatCount="indefinite" /></circle></g>}
      </svg>
      <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 10, fontWeight: 700, color: 'rgba(199,255,51,.6)', letterSpacing: '1px' }}>● LIVE TRACKING</div>
    </div>
  );
}
