import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Sheet } from './Sheet';
import { Button, Card } from './primitives';
import { useTheme } from './ThemeContext';
import { satoshi } from './theme';
import { fmt } from './fmt';

const TEST_CARDS = [
  { label: '3D Secure', num: '4000 0025 0000 3155' },
  { label: 'Instant', num: '4242 4242 4242 4242' },
  { label: 'Declined', num: '4000 0000 0000 9995' },
];
const groupCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

function PayLine({ l, v, green }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: t.gray, fontSize: 14 }}>{l}</Text>
      <Text style={{ color: green ? t.ok : t.text, fontFamily: green ? satoshi(700) : undefined, fontSize: 14 }}>{v}</Text>
    </View>
  );
}
function PayErr({ children }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: 'rgba(239,68,68,.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: t.danger, fontSize: 13, fontFamily: satoshi(600) }}>{children}</Text>
    </View>
  );
}

// Stripe-style simulated payment sheet (test cards + fake 3DS) — ported 1:1 from
// shared/index.jsx's web <PaymentSheet>. `confirmPayment` is supplied by the app
// (each app owns its own API client) and should POST to /api/payments/confirm.
export function PaymentSheet({ open, onClose, amountCents, title, description, cta = 'Pay', recurring = false, onAuthorized, confirmPayment }) {
  const t = useTheme();
  const [phase, setPhase] = useState('card');
  const [card, setCard] = useState('4000 0025 0000 3155');
  const [exp, setExp] = useState('12 / 34');
  const [cvc, setCvc] = useState('123');
  const [auth, setAuth] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) { setPhase('card'); setCard('4000 0025 0000 3155'); setExp('12 / 34'); setCvc('123'); setAuth(null); setCode(''); setErr(''); setBusy(false); }
  }, [open]);

  const finish = async () => {
    setBusy(true); setErr('');
    try { await onAuthorized?.(); setPhase('success'); setTimeout(() => onClose?.(), 1300); }
    catch (e) { setErr(e.message || 'Payment captured but activation failed.'); setBusy(false); }
  };

  const confirm = async (withCode) => {
    setBusy(true); setErr('');
    try {
      const res = await confirmPayment({ card, code: withCode ? code : undefined, amount_cents: amountCents, description });
      if (res.status === 'requires_action') { setAuth(res.auth); setCode(res.auth?.demo_code || ''); setPhase('3ds'); setBusy(false); return; }
      if (res.status === 'succeeded') return finish();
      setErr('Payment could not be completed.'); setBusy(false);
    } catch (e) { setErr(e.message || 'Payment failed.'); setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={busy ? undefined : onClose} title={phase === '3ds' ? '' : title}>
      {phase === 'success' ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 64, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 30, fontFamily: satoshi(900), color: t.onAccentText }}>✓</Text>
          </View>
          <Text style={{ fontFamily: satoshi(900), fontSize: 19 }}>Payment authenticated</Text>
          <Text style={{ color: t.gray, fontSize: 13, marginTop: 4 }}>{fmt.money(amountCents)}{recurring ? ' / mo' : ''} · {description}</Text>
        </View>
      ) : phase === '3ds' ? (
        <>
          <View style={{ backgroundColor: t.navy, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontFamily: satoshi(900), fontSize: 15, color: '#fff' }}>🔒 {auth?.bank || 'Bank'} Secure</Text>
              <Text style={{ fontSize: 11, fontFamily: satoshi(700), color: t.accent }}>{auth?.brand} •••• {auth?.masked}</Text>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
              For your security, enter the one-time code to authorise this {recurring ? 'subscription' : 'payment'} of <Text style={{ color: '#fff', fontFamily: satoshi(700) }}>{fmt.money(amountCents)}</Text>.
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>Authentication code</Text>
          <TextInput
            keyboardType="number-pad" maxLength={6} placeholder="••••••" value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            style={{ textAlign: 'center', fontSize: 24, fontFamily: satoshi(800), letterSpacing: 10, borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, marginBottom: 12 }}
          />
          {!!auth?.demo_code && (
            <View style={{ backgroundColor: t.accentPale, borderWidth: 1.5, borderColor: t.accentD, borderStyle: 'dashed', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: t.navy, fontSize: 12 }}>🔒 <Text style={{ fontFamily: satoshi(700) }}>Demo mode</Text> — your bank would SMS this. Code: <Text style={{ fontFamily: satoshi(700) }}>{auth.demo_code}</Text></Text>
            </View>
          )}
          {!!err && <PayErr>{err}</PayErr>}
          <Button variant="lime" disabled={code.length !== 6 || busy} onPress={() => confirm(true)}>{busy ? 'Authenticating…' : 'Authenticate'}</Button>
          <Pressable onPress={() => { setPhase('card'); setErr(''); }} style={{ alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: t.gray, fontSize: 13, fontFamily: satoshi(600) }}>← Cancel</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: t.gray, fontSize: 13 }}>{description}</Text>
            <Text style={{ fontFamily: satoshi(900), fontSize: 18 }}>{fmt.money(amountCents)}{recurring ? <Text style={{ fontSize: 12, color: t.gray }}> / mo</Text> : null}</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>Card number</Text>
          <TextInput
            keyboardType="number-pad" placeholder="1234 1234 1234 1234" value={card}
            onChangeText={(v) => setCard(groupCard(v))}
            style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>Expiry</Text>
              <TextInput placeholder="MM / YY" value={exp} onChangeText={setExp} style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>CVC</Text>
              <TextInput keyboardType="number-pad" maxLength={4} placeholder="CVC" value={cvc} onChangeText={(v) => setCvc(v.replace(/\D/g, ''))} style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15 }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <Text style={{ color: t.gray, fontSize: 11 }}>Test cards:</Text>
            {TEST_CARDS.map((c) => (
              <Pressable key={c.num} onPress={() => setCard(c.num)} style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: t.gray3, backgroundColor: card === c.num ? t.navy : '#fff' }}>
                <Text style={{ fontSize: 11, fontFamily: satoshi(700), color: card === c.num ? '#fff' : t.gray }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          {!!err && <PayErr>{err}</PayErr>}
          <Button variant="lime" disabled={busy} onPress={() => confirm(false)}>{busy ? 'Processing…' : `${cta} ${fmt.money(amountCents)}`}</Button>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 12 }}>
            <Text style={{ color: t.gray2, fontSize: 11 }}>🔒 Secured by</Text>
            <Text style={{ color: t.navy, fontSize: 11, fontFamily: satoshi(700) }}>Stripe</Text>
            <Text style={{ color: t.gray2, fontSize: 11 }}>· test mode</Text>
          </View>
        </>
      )}
    </Sheet>
  );
}
