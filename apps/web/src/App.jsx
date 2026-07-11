import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Logo, Mark, Avatar, api } from '@shared';
import Landing from './pages/Landing.jsx';
import Order from './pages/Order.jsx';
import Account from './pages/Account.jsx';
import Prices from './pages/Prices.jsx';
import Login from './pages/Login.jsx';
import { customerId, getAuth, saveAuth, logout } from './auth.js';

// gate authenticated pages — bounce to /login when there's no session
function RequireAuth({ children }) {
  if (customerId()) return children;
  // a magic-login (?login=) is resolving — don't bounce mid-flight
  if (new URLSearchParams(window.location.search).get('login')) return null;
  return <Navigate to="/login" replace />;
}

export default function App() {
  // magic-login deep link: /any?login=<customerId> signs in and continues
  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams.get('login');
    if (p && !customerId()) {
      api.get('/api/users/' + p).then((u) => {
        if (u?.id) { saveAuth(u); url.searchParams.delete('login'); window.location.replace(url.pathname + url.search); }
      });
    }
  }, []);

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/order" element={<RequireAuth><Order /></RequireAuth>} />
        <Route path="/prices" element={<RequireAuth><Prices /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/track" element={<RequireAuth><Account initialTab="orders" /></RequireAuth>} />
        <Route path="*" element={<Landing />} />
      </Routes>
      <Footer />
    </>
  );
}

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const onLanding = pathname === '/';
  const auth = getAuth();
  const jump = (id) => {
    if (onLanding) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else nav('/#' + id);
  };
  return (
    <nav className="nav">
      <div className="web-wrap nav-inner">
        <Link to="/"><Logo size={22} theme="dark" /></Link>
        <div className="nav-links">
          {onLanding && <>
            <a onClick={() => jump('how')}>How it works</a>
            <a onClick={() => jump('services')}>Services</a>
            <a onClick={() => jump('areas')}>Areas</a>
            <a onClick={() => jump('pricing')}>Pricing</a>
          </>}
          {auth ? <>
            <Link to="/order" className="nav-cta">Place order</Link>
            <Link to="/prices">🏷️ Prices & Services</Link>
            <a onClick={() => setMenuOpen(true)}>☰ Menu</a>
          </> : <>
            <Link to="/login">Log in</Link>
            <Link to="/order" className="nav-cta">Order now</Link>
          </>}
        </div>
      </div>
      <MenuFlyout open={menuOpen} onClose={() => setMenuOpen(false)} auth={auth} />
    </nav>
  );
}

function MenuFlyout({ open, onClose, auth }) {
  const nav = useNavigate();
  if (!open) return null;
  const go = (path) => { onClose(); nav(path); };
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,64,.45)', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '90vw', background: '#fff',
        boxShadow: '-8px 0 30px rgba(0,0,0,.2)', padding: 28, overflowY: 'auto',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, fontSize: 22, color: 'var(--navy)' }}>×</button>
        <div className="cl-row" style={{ gap: 14, marginBottom: 24 }}>
          <Avatar name={auth?.name} size={44} />
          <div style={{ fontSize: 18, fontWeight: 900 }}>Hi, {auth?.name?.split(' ')[0] || 'there'}</div>
        </div>

        <MenuLink icon="📦" label="My orders" onClick={() => go('/account?tab=orders')} />
        <MenuLink icon="🏷️" label="Prices & Services" onClick={() => go('/prices')} />
        <MenuLink icon="🔁" label="Repeat orders" onClick={() => go('/account?tab=repeat')} />

        <div className="cl-eyebrow" style={{ margin: '20px 0 8px' }}>Save with ChaseLaundry</div>
        <MenuLink icon="💳" label="My wallet" onClick={() => go('/account?tab=wallet')} />
        <MenuLink icon="⭐" label="Subscriptions" onClick={() => go('/account?tab=subscription')} />
        <MenuLink icon="🧺" label="Prepaid packs" onClick={() => go('/account?tab=packs')} />
        <MenuLink icon="🏷️" label="Promotions" onClick={() => go('/account?tab=wallet')} />
        <MenuLink icon="🎁" label="Refer a friend" onClick={() => go('/account?tab=wallet')} />

        <div className="cl-eyebrow" style={{ margin: '20px 0 8px' }}>More</div>
        <MenuLink icon="👤" label="Account" onClick={() => go('/account?tab=profile')} />
        <MenuLink icon="💬" label="Help centre" onClick={() => go('/account?tab=support')} />
        <button onClick={() => { onClose(); logout(); }} style={{ color: 'var(--danger)', fontWeight: 800, marginTop: 20, fontSize: 15 }}>Log out</button>
      </div>
    </div>,
    document.body,
  );
}

function MenuLink({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="cl-row" style={{ gap: 12, padding: '11px 0', width: '100%', textAlign: 'left', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </button>
  );
}

function Footer() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const jump = (id) => {
    if (pathname === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else nav('/#' + id);
  };
  return (
    <footer className="foot">
      <div className="web-wrap">
        <div className="foot-grid">
          <div>
            <Logo size={20} theme="dark" tagline />
            <p style={{ fontSize: 14, marginTop: 16, maxWidth: 320, lineHeight: 1.6 }}>
              Doorstep laundry & dry cleaning, collected and returned within 24 hours. Zero effort.
            </p>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, marginBottom: 8, fontSize: 14 }}>Company</div>
            <a>About</a><a>Careers</a><a>Press</a>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, marginBottom: 8, fontSize: 14 }}>Service</div>
            <a onClick={() => jump('how')} style={{ cursor: 'pointer' }}>How it works</a>
            <a onClick={() => jump('pricing')} style={{ cursor: 'pointer' }}>Pricing</a>
            <a onClick={() => jump('areas')} style={{ cursor: 'pointer' }}>Areas covered</a>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, marginBottom: 8, fontSize: 14 }}>Support</div>
            <a>Help centre</a><a>Contact</a><a>Terms & privacy</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 36, paddingTop: 22, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>© 2025 ChaseLaundry · More Life. Less Laundry.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mark size={18} /> chaselaundry.com</span>
        </div>
      </div>
    </footer>
  );
}
