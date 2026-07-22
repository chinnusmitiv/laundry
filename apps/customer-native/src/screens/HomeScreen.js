import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card, Button, Sheet, useTheme, satoshi } from '@chaselaundry/shared-native';
import Loading from '../components/Loading';
import OrderRow from '../components/OrderRow';
import AddressPicker from '../components/AddressPicker';
import { spawnTracking } from '../lib/api';

export default function HomeScreen({ customer, summary, orders, onOpenOrder, onOrder, onTab, onReload }) {
  const t = useTheme();
  const [addrOpen, setAddrOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  if (!summary) return <Loading />;
  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const addr = summary.addresses?.find((a) => a.is_default) || summary.addresses?.[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.light }} contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
      <Pressable onPress={() => setAddrOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 20, ...t.shadowSm }}>
        <Text style={{ fontSize: 15 }}>🏠</Text>
        <Text numberOfLines={1} style={{ fontFamily: satoshi(800), fontSize: 12, letterSpacing: 0.3, color: t.navy, maxWidth: 200 }}>
          {addr ? addr.line1.toUpperCase() : 'ADD YOUR ADDRESS'}
        </Text>
        <Text style={{ color: t.gray2 }}>›</Text>
      </Pressable>
      <AddressPicker open={addrOpen} onClose={() => setAddrOpen(false)} customer={customer} summary={summary} onReload={onReload} />

      <Card style={{ marginBottom: 14, padding: 22 }}>
        <Text style={{ fontSize: 26, fontFamily: satoshi(900), lineHeight: 30, letterSpacing: -0.5, color: t.navy, marginBottom: 8 }}>
          Take back your time.{'\n'}Leave the laundry to us.
        </Text>
        <Text style={{ color: t.gray, fontSize: 14, marginBottom: 16 }}>
          Laundry & dry cleaning with free 48-hour delivery, right to your door.
        </Text>
        <Button variant="lime" onPress={onOrder}>Schedule your pickup →</Button>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, color: '#FBBF24', letterSpacing: 1 }}>★★★★★</Text>
          <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>Rated Excellent</Text>
          <Text style={{ fontSize: 12, color: t.gray }}>· 5,243 reviews</Text>
        </View>

        <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 14 }} />
        <View style={{ gap: 8 }}>
          {['Free collection & 48h delivery', 'Best price guaranteed', 'No minimum order'].map((tx) => (
            <View key={tx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 18, height: 18, borderRadius: 18, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: t.onAccentText }}>✓</Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: satoshi(700), color: t.navy }}>{tx}</Text>
            </View>
          ))}
        </View>
      </Card>

      {active.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2, marginBottom: 10 }}>Active orders</Text>
          {active.map((o) => <OrderRow key={o.id} o={o} onPress={() => onOpenOrder(o.id)} />)}
        </View>
      )}

      <Card onPress={async () => { const o = await spawnTracking(customer.id); onOpenOrder(o.id); }}
        style={{ marginBottom: 14, borderWidth: 1.5, borderColor: t.navy, borderStyle: 'dashed' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: satoshi(900) }}>🚗 Track a live driver</Text>
            <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>Demo: spawn an out-for-delivery order & watch it move</Text>
          </View>
          <Text style={{ fontSize: 22 }}>→</Text>
        </View>
      </Card>

      <Card style={{ marginBottom: 14, backgroundColor: t.accentPale }} onPress={() => setHowOpen(true)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: satoshi(900), color: t.navy, marginBottom: 4 }}>Getting started?</Text>
            <Text style={{ fontSize: 12, color: t.gray }}>See how ChaseLaundry works and learn more about our services.</Text>
            <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Button sm variant="navy" onPress={() => setHowOpen(true)}>Start now</Button>
            </View>
          </View>
          <Text style={{ fontSize: 30 }}>💚</Text>
        </View>
      </Card>
      <HowItWorksSheet open={howOpen} onClose={() => setHowOpen(false)} />

      <Card style={{ marginBottom: 14, backgroundColor: t.accentPale }} onPress={() => onTab('wallet')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: satoshi(900), color: t.navy, marginBottom: 4 }}>Refer a friend</Text>
            <Text style={{ fontSize: 12, color: t.gray }}>Your friend gets 15% off — you earn S$25 on their first order!</Text>
            <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Button sm variant="navy" onPress={() => onTab('wallet')}>Invite friends</Button>
            </View>
          </View>
          <Text style={{ fontSize: 34 }}>🎁</Text>
        </View>
      </Card>

      <Card style={{ marginBottom: 14 }} onPress={() => onTab('wallet')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: satoshi(900), color: t.navy }}>Prepay and save on your frequent laundry items</Text>
            <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Button sm variant="navy" onPress={() => onTab('wallet')}>Save now</Button>
            </View>
          </View>
          <View style={{ width: 70, height: 70, borderRadius: 70, backgroundColor: t.accentPale, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: satoshi(700), color: t.navy }}>up to</Text>
            <Text style={{ fontSize: 17, fontFamily: satoshi(900), color: t.navy }}>20%</Text>
            <Text style={{ fontSize: 9, fontFamily: satoshi(700), color: t.navy }}>off</Text>
          </View>
        </View>
      </Card>

      <Pressable onPress={onOrder} style={{ flexDirection: 'row', marginBottom: 14, backgroundColor: t.accentPale, borderRadius: t.radius, overflow: 'hidden', ...t.shadowSm }}>
        <View style={{ width: 10, backgroundColor: t.light }} />
        <View style={{ padding: 18, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 14 }}>🏷️</Text>
            <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.navy }}>Promotion</Text>
          </View>
          <Text style={{ fontFamily: satoshi(900), fontSize: 18, color: t.navy, marginBottom: 12 }}>10% off mixed wash!</Text>
          <View style={{ alignSelf: 'flex-start' }}><Button sm variant="lime" onPress={onOrder}>Claim now</Button></View>
        </View>
      </Pressable>

      <Card onPress={() => onTab('account')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View>
            <Text style={{ fontFamily: satoshi(900), color: t.navy }}>ChaseLaundry+</Text>
            <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>Skip the service fee for just S$19 / month</Text>
            <Text style={{ fontFamily: satoshi(800), color: t.navy, fontSize: 13, marginTop: 8 }}>Join now ›</Text>
          </View>
          <Text style={{ fontSize: 34 }}>➕</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

function HowItWorksSheet({ open, onClose }) {
  const t = useTheme();
  const steps = [
    { icon: '🛍️', title: 'Book it & bag it', body: 'Pick a pickup slot and bag up your laundry — we come to your door.' },
    { icon: '🧺', title: 'Cleaned with care, locally', body: 'Your items are tagged, tracked and cared for at our local facility.' },
    { icon: '🚚', title: 'Free delivery, fresh results', body: 'Fresh and folded, delivered back to your door within 48h.' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="How ChaseLaundry works">
      {steps.map((s, i) => (
        <Card key={s.title} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Text style={{ fontSize: 26 }}>{s.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{i + 1}. {s.title}</Text>
              <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>{s.body}</Text>
            </View>
          </View>
        </Card>
      ))}
    </Sheet>
  );
}
