import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Sheet } from './Sheet';
import { Card, Button } from './primitives';
import { useTheme } from './ThemeContext';
import { satoshi } from './theme';
import { fmt } from './fmt';
import { topupBonus } from './constants';

const TOPUP_QUICK = [2000, 5000, 10000, 20000];

// Wallet top-up with promotional bonus tiers — ported 1:1 from shared/index.jsx's web
// <TopUpSheet>.
export function TopUpSheet({ open, onClose, onContinue }) {
  const t = useTheme();
  const [amount, setAmount] = useState(5000);
  useEffect(() => { if (open) setAmount(5000); }, [open]);
  const { bonus, pct } = topupBonus(amount);

  return (
    <Sheet open={open} onClose={onClose} title="Top up wallet">
      <Card style={{ backgroundColor: t.navy2, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: satoshi(900), fontSize: 16, color: '#fff' }}>Top up more, get more</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>Earn up to <Text style={{ color: t.accent, fontFamily: satoshi(700) }}>20% bonus credit</Text> — limited time!</Text>
          </View>
        </View>
      </Card>

      <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2, marginBottom: 10 }}>Choose amount</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {TOPUP_QUICK.map((amt) => {
          const b = topupBonus(amt);
          const on = amount === amt;
          return (
            <Card key={amt} onPress={() => setAmount(amt)} style={{ width: '47%', borderWidth: 2, borderColor: on ? t.navy : 'transparent', padding: 14 }}>
              <Text style={{ fontFamily: satoshi(900), fontSize: 18 }}>{fmt.money(amt)}</Text>
              {b.bonus > 0
                ? <Text style={{ fontSize: 12, fontFamily: satoshi(800), color: t.accentD, marginTop: 2 }}>+{fmt.money(b.bonus)} free</Text>
                : <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>no bonus</Text>}
            </Card>
          );
        })}
      </View>

      <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>Or enter a custom amount (S$)</Text>
      <TextInput
        keyboardType="number-pad" placeholder="e.g. 75" value={amount ? String(amount / 100) : ''}
        onChangeText={(v) => setAmount(Math.round((parseFloat(v) || 0) * 100))}
        style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Row l="You pay" v={fmt.money(amount)} />
        {bonus > 0 && <Row l={`Bonus credit (+${pct}%)`} v={`+ ${fmt.money(bonus)}`} green />}
        <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 8 }} />
        <Row l="Total credit" v={fmt.money(amount + bonus)} bold />
      </Card>

      <Button variant="lime" disabled={amount < 500} onPress={() => onContinue(amount)}>Continue to payment · {fmt.money(amount)}</Button>
      {amount < 500 && <Text style={{ color: t.gray, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Minimum top-up is S$5</Text>}
    </Sheet>
  );
}

function Row({ l, v, green, bold }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 14, fontFamily: bold ? satoshi(800) : undefined }}>{l}</Text>
      <Text style={{ fontSize: bold ? 15 : 14, color: green ? t.ok : t.text, fontFamily: green || bold ? satoshi(700) : undefined }}>{v}</Text>
    </View>
  );
}
