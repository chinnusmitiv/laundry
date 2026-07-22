import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable } from 'react-native';
import { Card, Chip, Button, Sheet, Avatar, Empty, PaymentSheet, useTheme, satoshi, fmt, REPEAT_CADENCE, nextRepeatDue, StatusPill } from '@chaselaundry/shared-native';
import Loading from '../components/Loading';
import MenuRow from '../components/MenuRow';
import AddAddress from '../components/AddAddress';
import AddressRow from '../components/AddressRow';
import ReferralCard from '../components/ReferralCard';
import { getPlans, activateSubscription, cancelSubscription, updateProfile, confirmPayment } from '../lib/api';

export default function AccountScreen({ customer, summary, orders = [], onOpenOrder, onOrder, onReload, onTab, onLogout, openOrders = 0 }) {
  const t = useTheme();
  const [sheet, setSheet] = useState(null);
  if (!summary) return <View style={{ flex: 1, backgroundColor: t.light }}><Loading /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.light }} contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
      <Text style={{ fontSize: 22, fontFamily: satoshi(900), marginBottom: 16 }}>More</Text>

      <Eyebrow>Orders</Eyebrow>
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="📦" label="Past orders" badge={openOrders > 0 ? `${openOrders} active` : null} onPress={() => onTab?.('orders')} />
        <MenuRow icon="🔁" label="Repeat orders" last onPress={() => setSheet('repeat')} />
      </Card>

      <Eyebrow>Offers & rewards</Eyebrow>
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="💳" label="My wallet" onPress={() => onTab?.('wallet')} />
        <MenuRow icon="⭐" label="Subscriptions" badge={summary.subscription ? summary.subscription.plan_name : null} onPress={() => setSheet('subscriptions')} />
        <MenuRow icon="🏷️" label="Promotions" onPress={() => setSheet('promotions')} />
        <MenuRow icon="🎁" label="Refer a friend" last onPress={() => setSheet('refer')} />
      </Card>

      <Eyebrow>Account & help</Eyebrow>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="👤" label="Account" onPress={() => setSheet('profile')} />
        <MenuRow icon="❓" label="FAQ" onPress={() => setSheet('faq')} />
        <MenuRow icon="💬" label="Help & Support" onPress={() => onTab?.('support')} />
        <MenuRow icon="🚪" label="Log out" danger last onPress={onLogout} />
      </Card>

      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} customer={customer} summary={summary} onReload={onReload} />
      <SubscriptionsSheet open={sheet === 'subscriptions'} onClose={() => setSheet(null)} customer={customer} summary={summary} onReload={onReload} />
      <PromotionsSheet open={sheet === 'promotions'} onClose={() => setSheet(null)} onOrder={onOrder} setSheet={setSheet} />
      <Sheet open={sheet === 'refer'} onClose={() => setSheet(null)} title="Refer a friend"><ReferralCard customer={customer} /></Sheet>
      <RepeatOrdersSheet open={sheet === 'repeat'} onClose={() => setSheet(null)} orders={orders} onOpenOrder={onOpenOrder} onOrder={onOrder} />
      <FAQSheet open={sheet === 'faq'} onClose={() => setSheet(null)} />
    </ScrollView>
  );
}

function Eyebrow({ children }) {
  const t = useTheme();
  return <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2, marginBottom: 10 }}>{children}</Text>;
}

function ProfileSheet({ open, onClose, customer, summary, onReload }) {
  const [addingAddr, setAddingAddr] = useState(false);
  const t = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title="Account">
      <ProfileCard customer={customer} user={summary.user} onReload={onReload} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
        <Eyebrow>Addresses</Eyebrow>
        <Pressable onPress={() => setAddingAddr((x) => !x)}><Text style={{ fontSize: 12, fontFamily: satoshi(800), color: t.navy }}>{addingAddr ? 'Cancel' : '+ Add'}</Text></Pressable>
      </View>
      {addingAddr && <AddAddress customerId={customer.id} onSaved={() => { setAddingAddr(false); onReload(); }} onCancel={() => setAddingAddr(false)} />}
      {summary.addresses.map((a) => <AddressRow key={a.id} customerId={customer.id} a={a} onReload={onReload} />)}
    </Sheet>
  );
}

function ProfileCard({ customer, user, onReload }) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');

  const save = async () => { setBusy(true); await updateProfile(customer.id, { name: name.trim(), phone: phone.trim() }); setBusy(false); setEditing(false); onReload?.(); };

  if (editing) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 14 }}>
          <Avatar name={name || user.name} size={52} />
          <View style={{ flex: 1 }}>
            <TextInput placeholder="Name" value={name} onChangeText={setName} style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 8 }} />
            <TextInput placeholder="Mobile number" value={phone} onChangeText={setPhone} style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 12, fontSize: 15 }} />
          </View>
        </View>
        <Text style={{ color: t.gray, fontSize: 12, marginBottom: 12 }}>Email: {user.email} (can't be changed)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button sm variant="ghost" onPress={() => { setName(user.name); setPhone(user.phone || ''); setEditing(false); }} style={{ flex: 1 }}>Cancel</Button>
          <Button sm variant="lime" disabled={busy || !name.trim()} onPress={save} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Save'}</Button>
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={user.name} size={52} />
          <View>
            <Text style={{ fontFamily: satoshi(900), fontSize: 18 }}>{user.name}</Text>
            <Text style={{ color: t.gray, fontSize: 13 }}>{user.email}</Text>
            {!!user.phone && <Text style={{ color: t.gray, fontSize: 13 }}>{user.phone}</Text>}
          </View>
        </View>
        <Pressable onPress={() => setEditing(true)}><Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>Edit</Text></Pressable>
      </View>
    </Card>
  );
}

function SubscriptionsSheet({ open, onClose, customer, summary, onReload }) {
  const t = useTheme();
  const [plans, setPlans] = useState([]);
  const [payPlan, setPayPlan] = useState(null);
  useEffect(() => { if (open) getPlans().then(setPlans); }, [open]);
  const current = summary.subscription?.plan_id || 'plan_lite';

  const activate = (plan_id) => activateSubscription(customer.id, plan_id).then(onReload);
  const choose = (plan) => { if (plan.price_cents) setPayPlan(plan); else activate(plan.id); };
  const cancel = async () => { await cancelSubscription(customer.id); onReload(); };

  return (
    <Sheet open={open} onClose={onClose} title="Subscriptions">
      {summary.subscription && <Text style={{ color: t.gray, marginBottom: 12 }}>Renews: {fmt.date(summary.subscription.renews_at)}</Text>}
      {plans.map((p) => {
        const active = p.id === current;
        return (
          <Card key={p.id} style={{ marginBottom: 12, borderWidth: 2, borderColor: active ? t.navy : 'transparent' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontFamily: satoshi(900), fontSize: 17 }}>{p.name}</Text>
                {active && <Chip variant="navy">current</Chip>}
              </View>
              <Text style={{ fontFamily: satoshi(900) }}>{p.price_cents ? `${fmt.money(p.price_cents)}/mo` : 'Free'}</Text>
            </View>
            <View style={{ marginVertical: 12, gap: 6 }}>
              {p.perks.map((perk, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: t.accentD }}>✓</Text>
                  <Text style={{ fontSize: 13, color: t.gray, flex: 1 }}>{perk}</Text>
                </View>
              ))}
            </View>
            {!active && <Button sm variant={p.id === 'plan_lite' ? 'ghost' : 'lime'} onPress={() => choose(p)}>{p.id === 'plan_lite' ? 'Downgrade to Lite' : `Switch to ${p.name}`}</Button>}
            {active && p.id !== 'plan_lite' && <View style={{ marginTop: 8 }}><Button sm variant="ghost" onPress={cancel}>Cancel subscription</Button></View>}
          </Card>
        );
      })}
      <PaymentSheet open={!!payPlan} onClose={() => setPayPlan(null)} amountCents={payPlan?.price_cents || 0}
        recurring cta="Subscribe" title={payPlan ? `Subscribe to ${payPlan.name}` : ''} description={payPlan ? `${payPlan.name} plan` : ''}
        confirmPayment={confirmPayment} onAuthorized={async () => { await activate(payPlan.id); }} />
    </Sheet>
  );
}

function PromotionsSheet({ open, onClose, onOrder, setSheet }) {
  const t = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title="Promotions">
      <Card style={{ marginBottom: 12 }} onPress={() => { onClose(); onOrder?.(); }}>
        <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.accentD, marginBottom: 8 }}>Promotion</Text>
        <Text style={{ fontFamily: satoshi(900), fontSize: 17, color: t.navy, marginBottom: 4 }}>10% off mixed wash!</Text>
        <Text style={{ fontSize: 12, color: t.gray }}>Applied automatically on Wash & Fold orders.</Text>
      </Card>
      <Card style={{ marginBottom: 12 }} onPress={() => { onClose(); setSheet('refer'); }}>
        <Text style={{ fontFamily: satoshi(900), fontSize: 15, color: t.navy, marginBottom: 4 }}>Refer a friend 🎁</Text>
        <Text style={{ fontSize: 12, color: t.gray }}>You both get S$5.00 when they place their first order.</Text>
      </Card>
      <Card onPress={() => { onClose(); setSheet('subscriptions'); }}>
        <Text style={{ fontFamily: satoshi(900), fontSize: 15, color: t.navy, marginBottom: 4 }}>ChaseLaundry+</Text>
        <Text style={{ fontSize: 12, color: t.gray }}>Skip the service fee for just S$19/month.</Text>
      </Card>
    </Sheet>
  );
}

function RepeatOrdersSheet({ open, onClose, orders, onOpenOrder, onOrder }) {
  const t = useTheme();
  const repeaters = orders.filter((o) => o.repeat_requested);
  return (
    <Sheet open={open} onClose={onClose} title="Repeat orders">
      {repeaters.length === 0
        ? <Empty icon="🔁" title="No repeat orders set up" sub='Toggle "Repeat this order" at checkout to schedule a standing pickup' />
        : repeaters.map((o) => {
          const due = nextRepeatDue(o);
          const dueNow = due && due <= new Date();
          return (
            <Card key={o.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontFamily: satoshi(800) }}>{o.code}</Text>
                  <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>{REPEAT_CADENCE[o.repeat_cadence]?.label || 'Repeat'} · {o.items?.length || 0} item(s)</Text>
                </View>
                <StatusPill status={o.status} label={o.status_label} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Pressable onPress={() => onOpenOrder(o.id)}><Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>View order ›</Text></Pressable>
                {dueNow && <Button sm variant="lime" onPress={onOrder}>Schedule next</Button>}
              </View>
            </Card>
          );
        })}
    </Sheet>
  );
}

function FAQSheet({ open, onClose }) {
  const t = useTheme();
  const faqs = [
    { q: 'How long does a service take?', a: 'Wash & Fold and Ironing are usually ready within 24h, Dry Cleaning within 48h, and Duvets & Bulky items within 72h from collection.' },
    { q: 'Is there a minimum order?', a: 'No — order as little or as much as you need.' },
    { q: 'What if my items are under-weighed or over-weighed?', a: "We charge based on the actual weight at our facility. If it differs from your estimate, we'll adjust the final price automatically." },
    { q: 'How do I cancel or reschedule a pickup?', a: "Open the order from Past orders and contact Support before the collection window — we'll sort it out." },
    { q: 'What happens if an item is damaged or lost?', a: 'Reach out via Help & Support with your order code — we investigate every case and make it right.' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="FAQ">
      {faqs.map((f) => (
        <Card key={f.q} style={{ marginBottom: 12 }}>
          <Text style={{ fontFamily: satoshi(800), fontSize: 14, marginBottom: 6 }}>{f.q}</Text>
          <Text style={{ fontSize: 13, color: t.gray, lineHeight: 19 }}>{f.a}</Text>
        </Card>
      ))}
    </Sheet>
  );
}
