import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { Sheet } from './Sheet';
import { Button } from './primitives';
import { useTheme } from './ThemeContext';
import { satoshi } from './theme';
import { fmt } from './fmt';

function PayErr({ children }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: 'rgba(239,68,68,.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: t.danger, fontSize: 13, fontFamily: satoshi(600) }}>{children}</Text>
    </View>
  );
}

// Real Stripe test-mode payment sheet — hands off to Stripe's own native
// PaymentSheet (initPaymentSheet/presentPaymentSheet), so every payment method
// enabled on the Stripe account (Card, PayNow, etc.) shows up automatically,
// same as the web app's <PaymentElement>. `createPaymentIntent` is supplied by
// the app (each app owns its own API client) and should POST to
// /api/payments/create-intent.
export function PaymentSheet({ open, onClose, amountCents, title, description, cta = 'Pay', recurring = false, onAuthorized, createPaymentIntent }) {
  const t = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [phase, setPhase] = useState('ready');
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [sheetReady, setSheetReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setPhase('ready'); setPaymentIntentId(null); setSheetReady(false); setErr(''); setBusy(false);
    (async () => {
      try {
        const res = await createPaymentIntent(amountCents, description);
        setPaymentIntentId(res.payment_intent_id);
        const { error } = await initPaymentSheet({
          merchantDisplayName: 'ChaseLaundry',
          paymentIntentClientSecret: res.client_secret,
          returnURL: 'chaselaundrycustomer://stripe-redirect',
        });
        if (error) setErr(error.message || 'Could not start payment.');
        else setSheetReady(true);
      } catch (e) { setErr(e.message || 'Could not start payment.'); }
    })();
  }, [open]);

  const finish = async () => {
    setBusy(true); setErr('');
    try { await onAuthorized?.(paymentIntentId); setPhase('success'); setTimeout(() => onClose?.(), 1300); }
    catch (e) { setErr(e.message || 'Payment captured but activation failed.'); setBusy(false); }
  };

  const pay = async () => {
    setBusy(true); setErr('');
    const { error } = await presentPaymentSheet();
    if (error) {
      if (error.code !== 'Canceled') setErr(error.message || 'Payment failed.');
      setBusy(false);
      return;
    }
    await finish();
  };

  return (
    <Sheet open={open} onClose={busy ? undefined : onClose} title={title}>
      {phase === 'success' ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 64, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 30, fontFamily: satoshi(900), color: t.onAccentText }}>✓</Text>
          </View>
          <Text style={{ fontFamily: satoshi(900), fontSize: 19 }}>Payment authenticated</Text>
          <Text style={{ color: t.gray, fontSize: 13, marginTop: 4 }}>{fmt.money(amountCents)}{recurring ? ' / mo' : ''} · {description}</Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: t.gray, fontSize: 13 }}>{description}</Text>
            <Text style={{ fontFamily: satoshi(900), fontSize: 18 }}>{fmt.money(amountCents)}{recurring ? <Text style={{ fontSize: 12, color: t.gray }}> / mo</Text> : null}</Text>
          </View>
          {!!err && <PayErr>{err}</PayErr>}
          <Button variant="lime" disabled={busy || !sheetReady} onPress={pay}>{busy ? 'Processing…' : `${cta} ${fmt.money(amountCents)}`}</Button>
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
