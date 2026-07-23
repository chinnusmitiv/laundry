import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Card, Chip, Button, Sheet, PaymentSheet, Empty, useTheme, satoshi, fmt } from '@chaselaundry/shared-native';
import Loading from './Loading';
import { getPacks, buyPack, createPaymentIntent } from '../lib/api';

export default function PacksSection({ customer, onReload }) {
  const t = useTheme();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('shop');
  const [buying, setBuying] = useState(null);
  const [payAmount, setPayAmount] = useState(0);

  const load = useCallback(() => getPacks(customer.id).then(setData), [customer.id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Loading />;

  const buy = async (paymentIntentId) => {
    await buyPack(customer.id, buying.catalog_id, buying.tier.qty, paymentIntentId);
    setBuying(null); setPayAmount(0); await load(); onReload?.();
  };

  const TabBtn = ({ k, label }) => (
    <Pressable onPress={() => setTab(k)} style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: tab === k ? t.navy : t.gray3 }}>
      <Text style={{ fontFamily: satoshi(800), fontSize: 13, color: tab === k ? '#fff' : t.gray }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2, marginBottom: 10 }}>Prepaid packs</Text>
      <Text style={{ fontSize: 12, color: t.gray, marginBottom: 12 }}>Unlock savings on your frequent items — separate from your wallet credit above.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TabBtn k="shop" label="Shop" />
        <TabBtn k="mine" label={`My Packs (${data.owned.length})`} />
      </View>

      {tab === 'shop' ? data.offers.map((o) => (
        <Card key={o.catalog_id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <Text style={{ fontSize: 22 }}>{o.icon}</Text>
            <Text style={{ fontFamily: satoshi(800) }}>{o.name} pack</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {o.tiers.map((tr) => (
              <View key={tr.qty} style={{ minWidth: 130, borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 12 }}>
                <Text style={{ fontFamily: satoshi(800), fontSize: 14 }}>{tr.qty}{o.unit === 'per_kg' ? 'kg' : ' items'}</Text>
                <View style={{ marginTop: 4, alignSelf: 'flex-start' }}><Chip variant="navy">{tr.discount_pct}% off</Chip></View>
                <Text style={{ marginTop: 8, fontFamily: satoshi(900) }}>{fmt.money(tr.price_cents)}</Text>
                <View style={{ marginTop: 8 }}>
                  <Button sm variant="navy" onPress={() => setBuying({ catalog_id: o.catalog_id, name: o.name, unit: o.unit, tier: tr })}>View offer</Button>
                </View>
              </View>
            ))}
          </ScrollView>
        </Card>
      )) : (
        data.owned.length === 0 ? <Empty icon="📦" title="No prepaid packs yet" sub="Buy a pack from the Shop tab to save on your frequent services" /> :
        data.owned.map((p) => {
          const remaining = Math.max(0, p.quantity_total - p.quantity_used);
          const expired = new Date(p.expires_at) < new Date();
          return (
            <Card key={p.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                  <View>
                    <Text style={{ fontFamily: satoshi(800) }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: t.gray }}>{remaining}{p.unit === 'per_kg' ? 'kg' : ' items'} left · expires {fmt.date(p.expires_at)}</Text>
                  </View>
                </View>
                <Chip variant={expired || remaining <= 0 ? 'gray' : 'navy'}>{expired ? 'expired' : remaining <= 0 ? 'used up' : 'active'}</Chip>
              </View>
            </Card>
          );
        })
      )}

      <Sheet open={!!buying} onClose={() => setBuying(null)} title={buying ? `${buying.name} pack` : ''}>
        {buying && (
          <View>
            <Card style={{ marginBottom: 16 }}>
              <Row l="Quantity" v={`${buying.tier.qty}${buying.unit === 'per_kg' ? 'kg' : ' items'}`} />
              <Row l="Discount" v={`${buying.tier.discount_pct}% off`} green />
              <Row l="Valid for" v={`${data.expiry_days} days`} />
              <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 8 }} />
              <Row l="Price" v={fmt.money(buying.tier.price_cents)} bold />
            </Card>
            <Button variant="lime" onPress={() => setPayAmount(buying.tier.price_cents)}>Buy for {fmt.money(buying.tier.price_cents)}</Button>
          </View>
        )}
      </Sheet>

      <PaymentSheet open={payAmount > 0} onClose={() => setPayAmount(0)} amountCents={payAmount} cta="Buy pack"
        title={buying ? `Buy ${buying.name} pack` : ''} description={buying ? `${buying.tier.qty}${buying.unit === 'per_kg' ? 'kg' : ' items'}` : ''}
        createPaymentIntent={createPaymentIntent} onAuthorized={buy} />
    </View>
  );
}

function Row({ l, v, green, bold }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 14 }}>{l}</Text>
      <Text style={{ fontSize: bold ? 15 : 14, color: green ? t.ok : t.text, fontFamily: green || bold ? satoshi(700) : undefined }}>{v}</Text>
    </View>
  );
}
