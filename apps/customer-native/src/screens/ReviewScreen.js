import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { getSummary, addAddress, quoteOrder, placeOrder, PICKUP_SLOTS } from '../lib/api';
import { colors } from '../theme';

function money(cents) { return `S$${(cents / 100).toFixed(2)}`; }

export default function ReviewScreen({ route, navigation, customer }) {
  const { cart, catalog } = route.params;
  const items = useMemo(() => Object.entries(cart)
    .filter(([, v]) => (v.qty || v.weight) > 0)
    .map(([catalog_id, v]) => ({ catalog_id, qty: v.qty, weight_kg: v.weight })), [cart]);

  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [addingAddr, setAddingAddr] = useState(false);
  const [newLine1, setNewLine1] = useState('');
  const [newPostcode, setNewPostcode] = useState('');
  const [slot, setSlot] = useState(PICKUP_SLOTS[0]);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    getSummary(customer.id).then((s) => {
      setAddresses(s.addresses || []);
      setAddrId((s.addresses?.find((a) => a.is_default) || s.addresses?.[0])?.id || null);
    });
    quoteOrder({ customer_id: customer.id, items, use_credit: true }).then(setQuote).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAddress = async () => {
    if (!newLine1.trim()) return;
    const a = await addAddress(customer.id, { type: 'home', label: 'Home', line1: newLine1.trim(), postcode: newPostcode.trim(), make_default: true });
    setAddresses((list) => [...list, a]);
    setAddrId(a.id);
    setAddingAddr(false);
    setNewLine1(''); setNewPostcode('');
  };

  const place = async () => {
    setError('');
    setPlacing(true);
    try {
      const order = await placeOrder({
        customer_id: customer.id, address_id: addrId, items, pickup_slot: slot,
        return_slot: 'Thu · 18:00–20:00', use_credit: true, notes: '', handover: 'hand_to_me', tip_cents: 0,
      });
      navigation.replace('Confirmation', { order });
    } catch (e) {
      setError(e.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.title}>Review your order</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {items.map((it) => {
          const c = catalog.find((x) => x.id === it.catalog_id);
          return (
            <View key={it.catalog_id} style={styles.row}>
              <Text style={styles.rowLabel}>{c?.icon} {c?.name}</Text>
              <Text style={styles.rowValue}>{it.weight_kg ? `${it.weight_kg}kg` : `×${it.qty}`}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickup slot</Text>
        {PICKUP_SLOTS.map((s) => (
          <Pressable key={s} style={[styles.optionRow, slot === s && styles.optionRowActive]} onPress={() => setSlot(s)}>
            <Text style={styles.optionText}>{s}</Text>
            {slot === s && <Text style={styles.check}>✓</Text>}
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Pickup address</Text>
          <Pressable onPress={() => setAddingAddr((x) => !x)}><Text style={styles.link}>{addingAddr ? 'Cancel' : '+ Add'}</Text></Pressable>
        </View>
        {addingAddr && (
          <View style={{ marginBottom: 12 }}>
            <TextInput style={styles.input} placeholder="Address line (e.g. 168732, ION Orchard…)" value={newLine1} onChangeText={setNewLine1} />
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Postcode" value={newPostcode} onChangeText={setNewPostcode} keyboardType="number-pad" />
            <Pressable style={styles.saveAddrBtn} onPress={saveAddress}><Text style={styles.saveAddrBtnText}>Save address</Text></Pressable>
          </View>
        )}
        {addresses.map((a) => (
          <Pressable key={a.id} style={[styles.optionRow, addrId === a.id && styles.optionRowActive]} onPress={() => setAddrId(a.id)}>
            <View>
              <Text style={styles.optionText}>{a.label}</Text>
              <Text style={styles.optionSub}>{a.line1}, {a.city} {a.postcode}</Text>
            </View>
            {addrId === a.id && <Text style={styles.check}>✓</Text>}
          </Pressable>
        ))}
        {!addresses.length && !addingAddr && <Text style={styles.optionSub}>No saved address yet — add one above.</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Total</Text>
        {!quote ? <ActivityIndicator color={colors.navy} /> : (
          <>
            <View style={styles.row}><Text style={styles.rowLabel}>Subtotal</Text><Text style={styles.rowValue}>{money(quote.subtotal_cents)}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Service fee</Text><Text style={styles.rowValue}>{quote.platform_fee_cents ? money(quote.platform_fee_cents) : 'WAIVED'}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Delivery</Text><Text style={styles.rowValue}>{quote.delivery_fee_cents ? money(quote.delivery_fee_cents) : 'FREE'}</Text></View>
            {quote.credit_applied_cents > 0 && <View style={styles.row}><Text style={styles.rowLabel}>Wallet credit</Text><Text style={[styles.rowValue, { color: colors.limeD }]}>−{money(quote.credit_applied_cents)}</Text></View>}
            <View style={[styles.row, { marginTop: 6 }]}><Text style={styles.totalLabel}>Total today</Text><Text style={styles.totalValue}>{money(quote.total_cents)}</Text></View>
          </>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.placeBtn, (placing || !quote) && { opacity: 0.6 }]} onPress={place} disabled={placing || !quote}>
        {placing ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.placeBtnText}>{quote ? `Place order · ${money(quote.total_cents)}` : 'Place order'}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '900', color: colors.navy, marginBottom: 16 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.gray2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  link: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: 14, color: colors.navy, fontWeight: '600' },
  rowValue: { fontSize: 14, color: colors.gray, fontWeight: '700' },
  totalLabel: { fontSize: 16, color: colors.navy, fontWeight: '900' },
  totalValue: { fontSize: 16, color: colors.navy, fontWeight: '900' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.gray3, marginBottom: 8 },
  optionRowActive: { borderColor: colors.navy },
  optionText: { fontWeight: '700', color: colors.navy, fontSize: 14 },
  optionSub: { color: colors.gray, fontSize: 12, marginTop: 2 },
  check: { color: colors.navy, fontWeight: '900' },
  input: { borderWidth: 1.5, borderColor: colors.gray3, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.navy },
  saveAddrBtn: { backgroundColor: colors.lime, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  saveAddrBtnText: { color: colors.navy, fontWeight: '800', fontSize: 14 },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '600', textAlign: 'center' },
  placeBtn: { backgroundColor: colors.lime, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  placeBtnText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
});
