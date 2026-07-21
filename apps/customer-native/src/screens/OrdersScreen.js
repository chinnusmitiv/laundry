import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getOrders } from '../lib/api';
import { colors } from '../theme';

function money(cents) { return `S$${(cents / 100).toFixed(2)}`; }

export default function OrdersScreen({ customer }) {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setError(''); setOrders(await getOrders(customer.id)); }
    catch (e) { setError(e.message || 'Could not load orders'); }
  }, [customer.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.page}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.code}>{item.code}</Text>
              <View style={styles.pill}><Text style={styles.pillText}>{item.status_label}</Text></View>
            </View>
            <Text style={styles.items}>{item.items?.length || 0} item{(item.items?.length || 0) === 1 ? '' : 's'} · {money(item.total_cents)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  error: { color: colors.danger, textAlign: 'center', marginTop: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.gray2, marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  code: { fontWeight: '900', fontSize: 16, color: colors.navy },
  pill: { backgroundColor: colors.limePale, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: colors.navy, fontWeight: '700', fontSize: 11 },
  items: { color: colors.gray2, fontSize: 12, fontWeight: '600' },
});
