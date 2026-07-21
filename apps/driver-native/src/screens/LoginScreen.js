import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { driverLogin } from '../lib/api';
import { saveDriver } from '../lib/session';
import { colors } from '../theme';

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('marcus@chaselaundry.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const { user } = await driverLogin(email.trim(), password);
      await saveDriver(user);
      onLoggedIn(user);
    } catch (e) {
      setError(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.brand}>Chase<Text style={{ color: colors.limeD }}>Laundry</Text></Text>
      <Text style={styles.subtitle}>Driver</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@chaselaundry.com"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="password"
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.buttonText}>Log in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 2 },
  subtitle: { fontSize: 14, fontWeight: '700', color: colors.gray3, marginBottom: 28, letterSpacing: 1 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.gray, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: colors.gray3, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.navy },
  error: { color: colors.danger, marginTop: 12, fontSize: 13, fontWeight: '600' },
  button: { backgroundColor: colors.lime, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  buttonText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
});
