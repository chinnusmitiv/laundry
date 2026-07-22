import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, Button, useTheme, satoshi, fmt } from '@chaselaundry/shared-native';
import ServicePicker from '../components/ServicePicker';
import Loading from '../components/Loading';
import { getCatalog } from '../lib/api';

export default function PricesScreen({ onSchedule, onTab }) {
  const t = useTheme();
  const [catalog, setCatalog] = useState(null);
  const [cart, setCart] = useState({});
  useEffect(() => { getCatalog().then(setCatalog); }, []);

  if (!catalog) return <View style={{ flex: 1, backgroundColor: t.light }}><Loading /></View>;

  const selected = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0);
  const totalCents = selected.reduce((sum, [id, v]) => {
    const c = catalog.find((x) => x.id === id);
    return sum + (c ? c.price_cents * (v.qty || v.weight || 0) : 0);
  }, 0);
  const book = () => selected.length && onSchedule(Object.fromEntries(selected));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.light }} contentContainerStyle={{ padding: 18, paddingBottom: 12 }}>
      <Text style={{ fontSize: 22, fontFamily: satoshi(900), marginBottom: 4 }}>Prices & services</Text>
      <Text style={{ color: t.gray, fontSize: 13, marginBottom: 16 }}>Straightforward pricing, no surprises.</Text>

      <ServicePicker catalog={catalog} cart={cart} setCart={setCart} initialCat="wash_fold" onAskTeam={() => onTab('support')} />

      <Card style={{ marginTop: 4, marginBottom: 16 }}>
        {[['⏱️', '48h turnaround'], ['🚫', 'No minimum order'], ['🚚', 'Free collection & delivery']].map(([icon, label], i, arr) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: i < arr.length - 1 ? 10 : 0 }}>
            <View style={{ width: 34, height: 34, borderRadius: 34, backgroundColor: t.accentPale, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15 }}>{icon}</Text>
            </View>
            <Text style={{ fontFamily: satoshi(700), fontSize: 14, color: t.navy }}>{label}</Text>
          </View>
        ))}
      </Card>

      <View style={{ backgroundColor: t.navy, borderRadius: 16, padding: 14 }}>
        {selected.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Estimated</Text>
            <Text style={{ fontFamily: satoshi(900), fontSize: 15, color: '#fff' }}>{fmt.money(totalCents)}</Text>
          </View>
        )}
        <Button variant="lime" disabled={!selected.length} onPress={book}>Book now →</Button>
      </View>
    </ScrollView>
  );
}
