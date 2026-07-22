import React from 'react';
import { View, Text } from 'react-native';
import { Card, StatusPill, useTheme, satoshi } from '@chaselaundry/shared-native';

export default function OrderRow({ o, onPress }) {
  const t = useTheme();
  return (
    <Card onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: satoshi(800) }}>{o.code}</Text>
          <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }} numberOfLines={1}>{o.items?.map((i) => i.name).join(' · ') || '—'}</Text>
        </View>
        <StatusPill status={o.status} label={o.status_label} />
      </View>
    </Card>
  );
}
