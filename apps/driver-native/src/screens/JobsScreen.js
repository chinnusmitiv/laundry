import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getJobs, STATUS_LABEL } from '../lib/api';
import { colors } from '../theme';

export default function JobsScreen({ driver, onLogout, navigation }) {
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setJobs(await getJobs(driver.id));
    } catch (e) {
      setError(e.message || 'Could not load jobs');
    }
  }, [driver.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hi, {driver.name?.split(' ')[0]}</Text>
          <Text style={styles.sub}>{jobs.length} active job{jobs.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={onLogout}><Text style={styles.logout}>Log out</Text></Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={jobs}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No active jobs assigned right now.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('JobDetail', { orderId: item.id })}>
            <View style={styles.cardTop}>
              <Text style={styles.code}>{item.code}</Text>
              <View style={styles.pill}><Text style={styles.pillText}>{STATUS_LABEL[item.status] || item.status}</Text></View>
            </View>
            <Text style={styles.customer}>{item.customer?.name}</Text>
            <Text style={styles.address} numberOfLines={1}>
              {item.address ? `${item.address.line1}, ${item.address.city}` : 'No address on file'}
            </Text>
            <Text style={styles.items}>{item.items?.length || 0} item{(item.items?.length || 0) === 1 ? '' : 's'} · {item.pickup_slot || 'No slot set'}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: colors.navy, padding: 20, paddingTop: 56 },
  hi: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: colors.gray3, fontSize: 13, marginTop: 2 },
  logout: { color: colors.lime, fontWeight: '700', fontSize: 13 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.gray2, marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  code: { fontWeight: '900', fontSize: 16, color: colors.navy },
  pill: { backgroundColor: colors.limePale, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: colors.navy, fontWeight: '700', fontSize: 11 },
  customer: { fontWeight: '700', fontSize: 14, color: colors.navy, marginBottom: 2 },
  address: { color: colors.gray, fontSize: 13, marginBottom: 6 },
  items: { color: colors.gray2, fontSize: 12, fontWeight: '600' },
});
