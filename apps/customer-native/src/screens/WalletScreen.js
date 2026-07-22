import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Card, Button, TopUpSheet, PaymentSheet, useTheme, satoshi, fmt, topupBonus } from '@chaselaundry/shared-native';
import Loading from '../components/Loading';
import PacksSection from '../components/PacksSection';
import ReferralCard from '../components/ReferralCard';
import { getCredits, topup, confirmPayment } from '../lib/api';

const TYPE_ICON = { referral: '🎁', in_store: '💚', signup: '👋', refund: '↩️', spend: '🧾', adjustment: '⚙️', topup: '➕', bonus: '🎁' };

export default function WalletScreen({ customer, onReload }) {
  const t = useTheme();
  const [data, setData] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);

  const loadWallet = useCallback(() => getCredits(customer.id).then(setData), [customer.id]);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.light }}><Loading /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.light }} contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
      <Card style={{ backgroundColor: t.navy, marginBottom: 16, alignItems: 'center', padding: 22 }}>
        <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>Wallet balance</Text>
        <Text style={{ fontSize: 40, fontFamily: satoshi(900), color: '#fff', marginVertical: 8 }}>{fmt.money(data.balance_cents)}</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginBottom: 14 }}>Applied automatically at checkout</Text>
        <Button variant="lime" onPress={() => setTopupOpen(true)}>+ Top up credit</Button>
      </Card>

      <TopUpSheet open={topupOpen} onClose={() => setTopupOpen(false)} onContinue={(amt) => { setTopupOpen(false); setPayAmount(amt); }} />
      <PaymentSheet open={payAmount > 0} onClose={() => setPayAmount(0)} amountCents={payAmount} cta="Top up"
        title="Top up wallet" description={`+ ${fmt.money(payAmount + topupBonus(payAmount).bonus)} credit`}
        confirmPayment={confirmPayment}
        onAuthorized={async () => { await topup(customer.id, payAmount); await loadWallet(); onReload?.(); }} />

      <PacksSection customer={customer} onReload={onReload} />
      <ReferralCard customer={customer} />

      <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2, marginBottom: 10 }}>Credit history</Text>
      <Card>
        {data.ledger.map((l, i) => (
          <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < data.ledger.length - 1 ? 1 : 0, borderBottomColor: t.gray3 }}>
            <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 18 }}>{TYPE_ICON[l.type] || '•'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{l.reason}</Text>
                <Text style={{ fontSize: 11, color: t.gray }}>{fmt.ago(l.created_at)}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: satoshi(800), color: l.amount_cents < 0 ? t.gray : t.ok }}>{l.amount_cents < 0 ? '' : '+'}{fmt.money(l.amount_cents)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
