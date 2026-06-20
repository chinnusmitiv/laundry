import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmt, Mark } from '@shared';

export default function Landing() {
  const nav = useNavigate();
  const [plans, setPlans] = useState([]);
  const [catalog, setCatalog] = useState([]);
  useEffect(() => {
    api.get('/api/plans').then(setPlans);
    api.get('/api/catalog').then(setCatalog);
    // honour /#anchor deep links
    const id = window.location.hash.replace('#', '');
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 100);
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-ring" style={{ width: 560, height: 560, top: -200, right: -120 }} />
        <div className="hero-ring" style={{ width: 300, height: 300, top: 40, right: 220 }} />
        <div className="web-wrap hero-grid">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(199,255,51,.12)', color: 'var(--lime)', padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, letterSpacing: '.5px', marginBottom: 24 }}>
              ● Now collecting across Singapore
            </div>
            <h1>More Life.<br /><span className="g">Less Laundry.</span></h1>
            <p>We collect, clean and return your clothes — fresh to your door within 24 hours. You just relax, we chiong for you. Every garment tracked some more.</p>
            <div style={{ display: 'flex', gap: 14 }}>
              <button className="cl-btn cl-btn-lime" style={{ width: 'auto', padding: '15px 30px' }} onClick={() => nav('/order')}>Schedule a pickup →</button>
              <button className="cl-btn" style={{ width: 'auto', padding: '15px 28px', background: 'rgba(255,255,255,.1)', color: '#fff' }} onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
            </div>
            <div style={{ display: 'flex', gap: 28, marginTop: 40 }}>
              {[['24h', 'turnaround'], ['4.9★', '1,200+ reviews'], ['100%', 'tracked garments']].map(([a, b]) => (
                <div key={a}><div style={{ fontSize: 28, fontWeight: 900, color: 'var(--lime)' }}>{a}</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{b}</div></div>
              ))}
            </div>
          </div>
          {/* hero card mock */}
          <div style={{ background: 'linear-gradient(145deg,#253470,#162040)', borderRadius: 26, padding: 30, boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Mark size={32} /><b style={{ color: '#fff', fontSize: 16 }}>Order CL-1042</b></div>
              <span className="cl-chip cl-chip-navy">On the way</span>
            </div>
            {[['🏷️', 'Checked in & tagged', 'done'], ['🫧', 'Washing', 'done'], ['🔥', 'Ironing', 'now'], ['📦', 'Packed', ''], ['✅', 'Returned to you', '']].map(([ic, label, st], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', opacity: st ? 1 : .4 }}>
                <div style={{ width: 38, height: 38, borderRadius: 38, background: st === 'done' ? 'var(--lime)' : st === 'now' ? 'rgba(199,255,51,.25)' : 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, outline: st === 'now' ? '2px solid var(--lime)' : 'none' }}>{ic}</div>
                <div style={{ color: '#fff', fontWeight: st === 'now' ? 800 : 500, flex: 1 }}>{label}</div>
                {st === 'done' && <span style={{ color: 'var(--lime)' }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="web-wrap" style={{ textAlign: 'center', marginBottom: 54 }}>
          <div className="section-eyebrow">How it works</div>
          <div className="section-title">Laundry day? Cancelled lah.</div>
          <p className="section-sub" style={{ margin: '0 auto' }}>Three taps and a doorstep handover. We settle the rest for you.</p>
        </div>
        <div className="web-wrap grid-4">
          {[
            ['1', 'Schedule', 'Pick your services and a collection slot that suits you.'],
            ['2', 'We collect', 'A ChaseLaundry driver picks up from your door — tracked live.'],
            ['3', 'We clean', 'Every garment is tagged and tracked through wash, dry, iron & QC.'],
            ['4', 'We return', 'Fresh, folded and back at your door within 24 hours.'],
          ].map(([n, t, d]) => (
            <div key={n} className="step">
              <div className="step-n">{n}</div>
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{t}</h3>
              <p style={{ color: 'var(--gray)', fontSize: 14, lineHeight: 1.6 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="section bg-light" id="services">
        <div className="web-wrap">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="section-eyebrow">Services</div>
            <div className="section-title">Everything in your wardrobe</div>
          </div>
          <div className="grid-4">
            {catalog.map((c) => (
              <div key={c.id} className="feat">
                <div className="ic">{c.icon}</div>
                <h3>{c.name}</h3>
                <p>{fmt.money(c.price_cents)} / {c.unit === 'per_kg' ? 'kg' : 'item'} · ready in {c.eta_hours}h</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY / FEATURES */}
      <section className="section">
        <div className="web-wrap">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="section-eyebrow">Why ChaseLaundry</div>
            <div className="section-title">Care you can track</div>
          </div>
          <div className="grid-3">
            {[
              ['🏷️', 'Every garment tagged', 'Each item gets a QR tag at intake — follow its journey from wash to fold in real time.'],
              ['📍', 'Live driver tracking', 'Watch your driver approach on the map and get notified at every step.'],
              ['💚', 'Wallet & referrals', 'Earn in-store credit, refer friends for S$5, and stack rewards automatically.'],
              ['🔄', 'Subscriptions', 'Weekly bundles from S$19/mo with free delivery and member discounts.'],
              ['💬', 'Human support', 'Chat with a real person 7am–11pm — replies in minutes.'],
              ['🌱', 'Eco-friendly', 'Eco detergents, reusable bags and route-optimised collections.'],
            ].map(([ic, t, d]) => (
              <div key={t} className="feat"><div className="ic">{ic}</div><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section bg-light" id="pricing">
        <div className="web-wrap">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="section-eyebrow">Pricing</div>
            <div className="section-title">Plans that pay for themselves</div>
            <p className="section-sub" style={{ margin: '0 auto' }}>Start free, upgrade anytime. Cancel also can, no hard feelings.</p>
          </div>
          <div className="price-grid">
            {plans.map((p) => (
              <div key={p.id} className={`price ${p.id === 'plan_plus' ? 'feat-plan' : ''}`}>
                {p.id === 'plan_plus' && <span className="cl-chip cl-chip-navy" style={{ position: 'absolute', top: -12, left: 32 }}>Most popular</span>}
                <div style={{ fontWeight: 900, fontSize: 22 }}>{p.name}</div>
                <div className="amt">{p.price_cents ? fmt.money(p.price_cents) : 'Free'}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray)' }}>{p.price_cents ? '/mo' : ''}</span></div>
                <ul>{p.perks.map((perk, i) => <li key={i}>{perk}</li>)}</ul>
                <button className={`cl-btn ${p.id === 'plan_plus' ? 'cl-btn-lime' : 'cl-btn-ghost'}`} onClick={() => nav('/order')}>{p.price_cents ? `Choose ${p.name}` : 'Get started'}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section">
        <div className="web-wrap">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="section-eyebrow">Loved across Singapore</div>
            <div className="section-title">4.9 ★ from 1,200+ reviews</div>
          </div>
          <div className="grid-3">
            {[
              ['“Confirm got my weekends back. Clothes come back like new, power!”', 'Sophie · Tiong Bahru'],
              ['“The garment tracking damn shiok — I watched my shirts go through ironing sia.”', 'Daniel · Tanjong Pagar'],
              ['“Driver early some more, support reply in 2 minutes. Steady lah!”', 'Aisha · Holland Village'],
            ].map(([q, who]) => (
              <div key={who} className="feat">
                <div style={{ color: 'var(--lime-d)', fontSize: 18, marginBottom: 10 }}>★★★★★</div>
                <p style={{ fontSize: 16, color: 'var(--text)', fontStyle: 'italic', lineHeight: 1.6 }}>{q}</p>
                <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>{who}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-navy" style={{ textAlign: 'center' }}>
        <div className="web-wrap">
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14 }}>Ready to skip laundry day or not?</div>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 18, marginBottom: 30 }}>Your first pickup can be today. Confirm plus chop.</p>
          <button className="cl-btn cl-btn-lime" style={{ width: 'auto', padding: '16px 36px', margin: '0 auto' }} onClick={() => nav('/order')}>Schedule a pickup →</button>
        </div>
      </section>
    </>
  );
}
