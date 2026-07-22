import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Chip, useTheme, satoshi } from '@chaselaundry/shared-native';

export default function MenuRow({ icon, label, badge, danger, last, onPress }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.gray3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        <Text style={{ fontFamily: satoshi(700), color: danger ? t.danger : t.text }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {badge ? <Chip variant="navy">{badge}</Chip> : null}
        {!danger && <Text style={{ color: t.gray2 }}>›</Text>}
      </View>
    </Pressable>
  );
}
