import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { getCatalog, CATEGORY_LABEL } from '../lib/api';
import { colors } from '../theme';

function money(cents) { return `S$${(cents / 100).toFixed(2)}`; }

function Stepper({ value, unit, onChange, step }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(0, +(value - step).toFixed(1)))}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value || 0}{unit && value ? unit : ''}</Text>
      <Pressable style={[styles.stepBtn, styles.stepBtnActive]} onPress={() => onChange(+(value + step).toFixed(1))}>
        <Text style={[styles.stepBtnText, { color: '#fff' }]}>+</Text>
      </Pressable>
    </View>
  );
}

export default function CatalogScreen({ customer, onLogout, navigation }) {
  const [catalog, setCatalog] = useState(null);
  const [cart, setCart] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    getCatalog().then(setCatalog).catch((e) => setError(e.message || 'Could not load prices'));
  }, []);

  const sections = useMemo(() => {
    if (!catalog) return [];
    const byCat = {};
    for (const c of catalog) (byCat[c.category] ||= []).push(c);
    return Object.keys(byCat).map((k) => ({ title: CATEGORY_LABEL[k] || k, data: byCat[k] }));
  }, [catalog]);

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const selected = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0);
  const totalCents = selected.reduce((sum, [id, v]) => {
    const c = catalog?.find((x) => x.id === id);
    return sum + (c ? c.price_cents * (v.qty || v.weight || 0) : 0);
  }, 0);

  if (!catalog) {
    return <View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.navy} />}</View>;
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hi, {customer.name?.split(' ')[0]}</Text>
          <Text style={styles.sub}>What needs cleaning?</Text>
        </View>
        <Pressable onPress={onLogout}><Text style={styles.logout}>Log out</Text></Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: selected.length ? 110 : 16 }}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item: c }) => {
          const v = cart[c.id] || {};
          const added = (c.unit === 'per_kg' ? v.weight : v.qty) > 0;
          return (
            <View style={[styles.card, added && styles.cardActive]}>
              <View style={styles.cardTop}>
                <Text style={styles.icon}>{c.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{c.name}</Text>
                  <Text style={styles.itemPrice}>{money(c.price_cents)} / {c.unit === 'per_kg' ? 'kg' : 'item'}</Text>
                </View>
                {!added ? (
                  <Pressable style={styles.addBtn} onPress={() => setItem(c.id, c.unit === 'per_kg' ? { weight: 1 } : { qty: 1 })}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </Pressable>
                ) : (
                  <Stepper
                    value={c.unit === 'per_kg' ? (v.weight || 0) : (v.qty || 0)}
                    step={c.unit === 'per_kg' ? 0.5 : 1}
                    unit={c.unit === 'per_kg' ? 'kg' : ''}
                    onChange={(val) => setItem(c.id, c.unit === 'per_kg' ? { weight: val } : { qty: val })}
                  />
                )}
              </View>
            </View>
          );
        }}
      />

      {selected.length > 0 && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerCount}>{selected.length} item{selected.length === 1 ? '' : 's'}</Text>
            <Text style={styles.footerTotal}>{money(totalCents)}</Text>
          </View>
          <Pressable style={styles.footerBtn} onPress={() => navigation.navigate('Review', { cart, catalog })}>
            <Text style={styles.footerBtnText}>Review order →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  error: { color: colors.danger, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: colors.navy, padding: 20, paddingTop: 56 },
  hi: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: colors.gray3, fontSize: 13, marginTop: 2 },
  logout: { color: colors.lime, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive: { backgroundColor: colors.limePale, borderColor: colors.limeD },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 26 },
  itemName: { fontWeight: '700', fontSize: 15, color: colors.navy },
  itemPrice: { fontSize: 13, color: colors.gray, marginTop: 2 },
  addBtn: { borderWidth: 1.5, borderColor: colors.navy, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: colors.navy, fontWeight: '800', fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 30, backgroundColor: colors.gray3, alignItems: 'center', justifyContent: 'center' },
  stepBtnActive: { backgroundColor: colors.navy },
  stepBtnText: { fontSize: 17, fontWeight: '800', color: colors.navy },
  stepValue: { minWidth: 40, textAlign: 'center', fontWeight: '800', color: colors.navy },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: colors.gray3 },
  footerCount: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  footerTotal: { fontSize: 18, fontWeight: '900', color: colors.navy },
  footerBtn: { backgroundColor: colors.lime, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  footerBtnText: { color: colors.navy, fontWeight: '800', fontSize: 14 },
});
