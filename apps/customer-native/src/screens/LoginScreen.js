import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { requestOtp, verifyOtp } from '../lib/api';
import { saveCustomer } from '../lib/session';
import { colors } from '../theme';

export default function LoginScreen({ onLoggedIn }) {
  const [stage, setStage] = useState('email'); // email → code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError('');
    setBusy(true);
    try {
      await requestOtp(email.trim());
      setStage('code');
    } catch (e) {
      setError(e.message || 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError('');
    setBusy(true);
    try {
      const { user } = await verifyOtp(email.trim(), code.trim());
      await saveCustomer(user);
      onLoggedIn(user);
    } catch (e) {
      setError(e.message || 'Incorrect code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.brand}>Chase<Text style={{ color: colors.limeD }}>Laundry</Text></Text>
      <Text style={styles.subtitle}>More life. Less laundry.</Text>

      <View style={styles.card}>
        {stage === 'email' ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoFocus
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={sendCode} disabled={busy || !email.trim()}>
              {busy ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.buttonText}>Send code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the 6-digit code sent to {email}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              placeholder="123456"
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={verify} disabled={busy || code.trim().length < 6}>
              {busy ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.buttonText}>Verify & continue</Text>}
            </Pressable>
            <Pressable onPress={() => setStage('email')} style={{ marginTop: 14 }}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 2 },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.gray3, marginBottom: 28 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.gray, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.gray3, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.navy, marginBottom: 4 },
  error: { color: colors.danger, marginTop: 10, fontSize: 13, fontWeight: '600' },
  button: { backgroundColor: colors.lime, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  buttonText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  link: { color: colors.navy, fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
