import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Sheet, Card, Button, ADDRESS_TYPES, satoshi, useTheme } from '@chaselaundry/shared-native';
import { setDefaultAddress } from '../lib/api';
import AddAddress from './AddAddress';

export default function AddressPicker({ open, onClose, customer, summary, onReload }) {
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const addresses = summary?.addresses || [];

  useEffect(() => { if (open) setAdding(false); }, [open]);

  const choose = async (a) => {
    if (!a.is_default) await setDefaultAddress(customer.id, a.id);
    onReload?.();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Choose your address">
      {!adding && addresses.map((a) => (
        <Card key={a.id} onPress={() => choose(a)} style={{ marginBottom: 10, borderWidth: 2, borderColor: a.is_default ? t.navy : 'transparent' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: satoshi(700) }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>{a.line1}, {a.postcode}</Text>
            </View>
            {a.is_default ? <Text>✓</Text> : null}
          </View>
        </Card>
      ))}
      {!adding ? (
        <Button variant="ghost" onPress={() => setAdding(true)}>+ Add new address</Button>
      ) : (
        <AddAddress customerId={customer.id} onSaved={() => { onReload?.(); onClose(); }} onCancel={() => setAdding(false)} />
      )}
    </Sheet>
  );
}
