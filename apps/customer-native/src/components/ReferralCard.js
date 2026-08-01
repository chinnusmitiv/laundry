import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Card, Chip, Button, useTheme, satoshi, fmt } from '@chaselaundry/shared-native';
import Loading from './Loading';
import { getReferrals, inviteReferral } from '../lib/api';

export default function ReferralCard({ customer }) {
  const t = useTheme();
  const [ref, setRef] = useState(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => getReferrals(customer.id).then(setRef), [customer.id]);
  useEffect(() => { load(); }, [load]);

  const alreadyInvited = (e) => ref?.referrals?.some((r) => r.referee_email.toLowerCase() === e.trim().toLowerCase());

  const invite = async () => {
    setSent(false);
    if (alreadyInvited(email)) { setError("You've already invited this email."); return; }
    try {
      await inviteReferral(customer.id, email);
      setError('');
      setSent(true);
      setEmail('');
      load();
    } catch (e) {
      setError(e.message || 'Could not send the invite.');
    }
  };

  if (!ref) return <Loading />;
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: satoshi(900), marginBottom: 4 }}>Refer a friend 🎁</Text>
      <Text style={{ fontSize: 13, color: t.gray, marginBottom: 12 }}>You both get {fmt.money(ref?.reward_cents || 500)} when they place their first order.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.accentPale, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 12 }}>
        <Text style={{ fontFamily: satoshi(900), letterSpacing: 1, color: t.navy }}>{ref?.code}</Text>
        <Chip>your code</Chip>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          placeholder="friend@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          style={{ flex: 1, borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15 }}
        />
        <Button sm variant="lime" disabled={!email} onPress={invite}>Invite</Button>
      </View>
      {sent && <Text style={{ color: t.ok, fontSize: 12, marginTop: 8, fontFamily: satoshi(700) }}>✓ Invite sent</Text>}
      {!!error && <Text style={{ color: t.danger, fontSize: 12, marginTop: 8, fontFamily: satoshi(700) }}>{error}</Text>}
      {ref?.referrals?.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {ref.referrals.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: t.gray, fontSize: 13 }}>{r.referee_email}</Text>
              <Chip variant={r.status === 'rewarded' ? 'navy' : 'gray'}>{r.status}</Chip>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
