import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Card, Button, PlacesAutocomplete, useTheme, satoshi } from '@chaselaundry/shared-native';
import { ADDRESS_TYPES } from '@chaselaundry/shared-native';
import { addAddress, placesSearch } from '../lib/api';

export default function AddAddress({ customerId, onSaved, onCancel }) {
  const t = useTheme();
  const [place, setPlace] = useState(null);
  const [type, setType] = useState('home');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const a = await addAddress(customerId, {
      type, label: label.trim() || ADDRESS_TYPES[type].label, line1: place.line1, line2: '',
      city: 'Singapore', postcode: place.postcode, lat: place.lat, lng: place.lng, make_default: true,
    });
    setSaving(false); onSaved(a);
  };

  return (
    <Card style={{ marginBottom: 12, backgroundColor: t.light }}>
      {!place ? (
        <PlacesAutocomplete autoFocus search={placesSearch} onSelect={setPlace} placeholder="Search address or postcode…" />
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View>
              <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>📍 {place.name}</Text>
              <Text style={{ fontSize: 12, color: t.gray }}>{place.line1} · {place.postcode}</Text>
            </View>
            <Pressable onPress={() => setPlace(null)}><Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>Change</Text></Pressable>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: t.gray, marginBottom: 6 }}>Address type</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {Object.entries(ADDRESS_TYPES).map(([k, a]) => (
              <Pressable key={k} onPress={() => setType(k)} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', borderWidth: type === k ? 2 : 1.5, borderColor: type === k ? t.navy : t.gray3, backgroundColor: type === k ? t.navy : '#fff' }}>
                <Text style={{ fontFamily: satoshi(700), fontSize: 13, color: type === k ? '#fff' : t.gray }}>{a.icon} {a.label}</Text>
              </Pressable>
            ))}
          </View>
          {type === 'other' && (
            <TextInput
              placeholder="Label (e.g. Mum's place, Gym)" value={label} onChangeText={setLabel}
              style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, backgroundColor: '#fff' }}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onCancel && <Button sm variant="ghost" onPress={onCancel} style={{ flex: 1 }}>Cancel</Button>}
            <Button sm variant="lime" disabled={saving} onPress={save} style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save address'}</Button>
          </View>
        </>
      )}
    </Card>
  );
}
