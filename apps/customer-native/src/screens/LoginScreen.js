import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Logo, Card, Field, Button, useTheme } from '@chaselaundry/shared-native';
import { requestOtp, verifyOtp } from '../lib/api';
import { saveCustomer } from '../lib/session';

export default function LoginScreen({ onLoggedIn }) {
  const t = useTheme();
  const [step, setStep] = useState('identify'); // identify | verify
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(null); // { sent_to, is_new }
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const requestCode = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await requestOtp(identifier.trim());
      setSent(res); setCode(''); setName(''); setStep('verify');
    } catch (e) { setErr(e.message || 'Could not send code. Try again.'); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const { user } = await verifyOtp(identifier.trim(), code, name);
      await saveCustomer(user);
      onLoggedIn(user);
    } catch (e) { setErr(e.message || 'Could not verify code. Try again.'); }
    finally { setBusy(false); }
  };

  const reset = () => { setStep('identify'); setCode(''); setErr(''); setSent(null); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.navy }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 10 }}>
          <Logo size={30} mode="dark" tagline />
        </View>
        <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 14, marginBottom: 26 }}>
          {step === 'identify' ? 'Sign in or create your account' : 'Enter the code to continue'}
        </Text>

        <Card>
          {step === 'identify' ? (
            <>
              <Field label="Email address" autoCapitalize="none" keyboardType="email-address"
                placeholder="you@email.com" value={identifier} onChangeText={setIdentifier} onSubmitEditing={requestCode} />
              {!!err && <ErrBox color={t.danger}>{err}</ErrBox>}
              <Button variant="lime" disabled={!identifier.trim() || busy} onPress={requestCode}>
                {busy ? 'Sending code…' : 'Send code'}
              </Button>
              <Text style={{ textAlign: 'center', fontSize: 12, color: t.gray, marginTop: 12 }}>
                No password needed — we'll email you a one-time code.
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: t.gray, marginBottom: 14 }}>
                We sent a 6-digit code to <Text style={{ fontFamily: 'Satoshi-Bold', color: t.navy }}>{sent?.sent_to}</Text>.
              </Text>

              {sent?.is_new && (
                <Field label="Your name" placeholder="e.g. Alex Morgan" value={name} onChangeText={setName} />
              )}

              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: t.gray, marginBottom: 6 }}>6-digit code</Text>
                <Field
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                  onSubmitEditing={() => code.length === 6 && verify()}
                  inputStyle={{ textAlign: 'center', fontSize: 26, fontFamily: 'Satoshi-Bold', letterSpacing: 10 }}
                  style={{ marginBottom: 0 }}
                />
              </View>

              {!!err && <ErrBox color={t.danger}>{err}</ErrBox>}

              <Button variant="lime" disabled={code.length !== 6 || (sent?.is_new && !name.trim()) || busy} onPress={verify}>
                {busy ? 'Verifying…' : sent?.is_new ? 'Create account' : 'Sign in'}
              </Button>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <Pressable onPress={reset}><Text style={{ color: t.gray, fontWeight: '600', fontSize: 13 }}>← Change</Text></Pressable>
                <Pressable onPress={requestCode} disabled={busy}><Text style={{ color: t.navy, fontWeight: '700', fontSize: 13 }}>Resend code</Text></Pressable>
              </View>

              {sent?.is_new && (
                <Text style={{ textAlign: 'center', fontSize: 12, color: t.gray, marginTop: 14 }}>
                  🎁 New accounts get <Text style={{ fontFamily: 'Satoshi-Bold' }}>S$10</Text> welcome credit
                </Text>
              )}
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrBox({ children, color }) {
  return (
    <View style={{ backgroundColor: 'rgba(239,68,68,.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}
