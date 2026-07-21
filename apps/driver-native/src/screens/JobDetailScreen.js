import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getOrder, setOrderStatus, DRIVER_ADVANCE, STATUS_LABEL } from '../lib/api';
import { colors } from '../theme';

export default function JobDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    try { setError(''); setOrder(await getOrder(orderId)); }
    catch (e) { setError(e.message || 'Could not load job'); }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const advance = async () => {
    const next = DRIVER_ADVANCE[order.status];
    if (!next) return;
    setAdvancing(true);
    try {
      const updated = await setOrderStatus(order.id, next);
      setOrder(updated);
      if (next === 'delivered') navigation.goBack();
    } catch (e) {
      setError(e.message || 'Could not update status');
    } finally {
      setAdvancing(false);
    }
  };

  if (!order) {
    return <View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.navy} />}</View>;
  }

  const next = DRIVER_ADVANCE[order.status];

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.code}>{order.code}</Text>
      <View style={styles.pill}><Text style={styles.pillText}>{STATUS_LABEL[order.status] || order.status}</Text></View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.value}>{order.customer?.name}</Text>
        <Text style={styles.sub}>{order.customer?.phone || 'No phone on file'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Address</Text>
        <Text style={styles.value}>{order.address ? `${order.address.line1}, ${order.address.city} ${order.address.postcode || ''}` : 'No address on file'}</Text>
        <Text style={styles.sub}>{order.pickup_slot || 'No slot set'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {(order.items || []).map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemQty}>{it.catalog_unit === 'per_kg' ? `${it.weight_kg}kg` : `×${it.qty}`}</Text>
          </View>
        ))}
      </View>

      {order.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.value}>{order.notes}</Text>
        </View>
      ) : null}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {next ? (
        <Pressable style={[styles.button, advancing && { opacity: 0.6 }]} onPress={advance} disabled={advancing}>
          {advancing ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.buttonText}>Mark as “{STATUS_LABEL[next]}”</Text>}
        </Pressable>
      ) : (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>No driver action needed right now — this order is with the facility.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  code: { fontSize: 22, fontWeight: '900', color: colors.navy },
  pill: { alignSelf: 'flex-start', backgroundColor: colors.limePale, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8, marginBottom: 20 },
  pillText: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.gray2, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  value: { fontSize: 15, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 13, color: colors.gray, marginTop: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemName: { fontSize: 14, color: colors.navy, fontWeight: '600' },
  itemQty: { fontSize: 14, color: colors.gray, fontWeight: '700' },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '600' },
  button: { backgroundColor: colors.lime, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  buttonText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  waitingBox: { backgroundColor: colors.gray3, borderRadius: 12, padding: 16, marginTop: 8 },
  waitingText: { color: colors.gray, fontSize: 13, textAlign: 'center' },
});
