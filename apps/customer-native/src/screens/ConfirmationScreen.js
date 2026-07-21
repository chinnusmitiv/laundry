import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

function money(cents) { return `S$${(cents / 100).toFixed(2)}`; }

export default function ConfirmationScreen({ route, navigation }) {
  const { order } = route.params;
  return (
    <View style={styles.page}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Order {order.code} confirmed!</Text>
      <Text style={styles.sub}>We'll assign a driver and collect at {order.pickup_slot}.</Text>
      <Text style={styles.total}>Total today: {money(order.total_cents)}</Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate('Orders')}>
        <Text style={styles.buttonText}>Track my orders →</Text>
      </Pressable>
      <Pressable style={styles.ghostButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.ghostButtonText}>Back to home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 60, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.navy, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.gray, textAlign: 'center', marginTop: 10 },
  total: { fontSize: 15, fontWeight: '800', color: colors.navy, marginTop: 16, marginBottom: 24 },
  button: { backgroundColor: colors.lime, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 28, alignItems: 'center', width: '100%' },
  buttonText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  ghostButton: { paddingVertical: 14, alignItems: 'center', width: '100%' },
  ghostButtonText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
});
