import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '@chaselaundry/shared-native';

export default function Loading() {
  const t = useTheme();
  return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={t.navy} /></View>;
}
