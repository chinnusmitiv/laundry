import React from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Logo, Mark } from '@shared';
import Landing from './pages/Landing.jsx';
import Order from './pages/Order.jsx';
import Account from './pages/Account.jsx';

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/order" element={<Order />} />
        <Route path="/account" element={<Account />} />
        <Route path="/track" element={<Account initialTab="orders" />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      <Footer />
    </>
  );
}

function NavBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const onLanding = pathname === '/';
  const jump = (id) => {
    if (onLanding) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else nav('/#' + id);
  };
  return (
    <nav className="nav">
      <div className="web-wrap nav-inner">
        <Link to="/"><Logo size={22} theme="dark" /></Link>
        <div className="nav-links">
          <a onClick={() => jump('how')}>How it works</a>
          <a onClick={() => jump('services')}>Services</a>
          <a onClick={() => jump('pricing')}>Pricing</a>
          <Link to="/account">Account</Link>
          <Link to="/order" className="nav-cta">Order now</Link>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
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
            <a>How it works</a><a>Pricing</a><a>Areas covered</a>
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
