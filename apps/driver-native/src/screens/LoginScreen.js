import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Logo, Card, Field, Button, useTheme } from '@chaselaundry/shared-native';
import { driverLogin } from '../lib/api';
import { saveDriver } from '../lib/session';

export default function LoginScreen({ onLoggedIn }) {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const { user } = await driverLogin(email.trim(), password);
      await saveDriver(user);
      onLoggedIn(user);
    } catch (e) { setErr(e.message || 'Could not sign in. Try again.'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.navy }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 10 }}>
          <Logo size={30} mode="dark" tagline />
        </View>
        <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 14, marginBottom: 26 }}>Driver sign in</Text>
        <Card>
          <Field label="Email" autoCapitalize="none" keyboardType="email-address" placeholder="you@chaselaundry.com"
            value={email} onChangeText={setEmail} />
          <Field label="Password" secureTextEntry placeholder="••••••••"
            value={password} onChangeText={setPassword} onSubmitEditing={submit} />
          {!!err && (
            <View style={{ backgroundColor: 'rgba(239,68,68,.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: t.danger, fontSize: 13, fontWeight: '600' }}>{err}</Text>
            </View>
          )}
          <Button variant="lime" disabled={!email.trim() || !password || busy} onPress={submit}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
