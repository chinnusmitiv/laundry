import React, { useState } from 'react';
import { api, Logo } from '@shared';
import { saveAuth } from '../auth.js';

// Passwordless email + OTP login — mirrors the customer mobile app.
export default function Login() {
  const [step, setStep] = useState('identify'); // identify | verify
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const requestOtp = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/api/auth/request-otp', { identifier });
      setSent(res); setCode(''); setName(''); setStep('verify');
    } catch (e) { setErr(e.message || 'Could not send code.'); }
    finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setErr(''); setBusy(true);
    try {
      const { user } = await api.post('/api/auth/verify-otp', { identifier, code, name });
      saveAuth(user);
      window.location.assign('/account'); // full reload so pages pick up the session
    } catch (e) { setErr(e.message || 'Could not verify code.'); setBusy(false); }
  };

  return (
    <div className="app-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Logo size={26} theme="light" /></div>
        <h1 style={{ fontWeight: 900, fontSize: 24, textAlign: 'center', marginBottom: 6 }}>
          {step === 'identify' ? 'Sign in or create account' : 'Enter your code'}
        </h1>
        <p className="cl-muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          {step === 'identify' ? 'No password needed — we email you a one-time code.' : <>Sent to <b>{sent?.sent_to}</b></>}
        </p>

        {step === 'identify' ? <>
          <label className="cl-label">Email address</label>
          <input className="cl-field" type="email" autoComplete="email" style={{ width: '100%', marginBottom: 14 }} placeholder="you@email.com"
            value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && identifier.trim() && requestOtp()} />
          {err && <ErrBox>{err}</ErrBox>}
          <button className="cl-btn cl-btn-lime" disabled={!identifier.trim() || busy} onClick={requestOtp}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
          <p className="cl-muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 14 }}>
            We'll email you a 6-digit code.
          </p>
        </> : <>
          {sent?.is_new && <>
            <label className="cl-label">Your name</label>
            <input className="cl-field" style={{ width: '100%', marginBottom: 14 }} placeholder="e.g. Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} />
          </>}
          <label className="cl-label">6-digit code</label>
          <input className="cl-field" inputMode="numeric" maxLength={6} placeholder="••••••"
            style={{ width: '100%', marginBottom: 14, textAlign: 'center', fontSize: 24, fontWeight: 800, letterSpacing: '10px' }}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verifyOtp()} />

          {err && <ErrBox>{err}</ErrBox>}
          <button className="cl-btn cl-btn-lime" disabled={code.length !== 6 || (sent?.is_new && !name.trim()) || busy} onClick={verifyOtp}>
            {busy ? 'Verifying…' : sent?.is_new ? 'Create account' : 'Sign in'}
          </button>
          <div className="cl-between" style={{ marginTop: 14, fontSize: 14 }}>
            <button onClick={() => { setStep('identify'); setErr(''); }} style={{ color: 'var(--gray)', fontWeight: 600 }}>← Change</button>
            <button onClick={requestOtp} disabled={busy} style={{ color: 'var(--navy)', fontWeight: 700 }}>Resend code</button>
          </div>
        </>}
      </div>
    </div>
  );
}

function ErrBox({ children }) {
  return <div style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)', fontSize: 14, fontWeight: 600, padding: '10px 12px', borderRadius: 10, marginBottom: 14 }}>{children}</div>;
}
