import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Card, Chip, Button, ADDRESS_TYPES, useTheme, satoshi } from '@chaselaundry/shared-native';
import { setDefaultAddress, updateAddress } from '../lib/api';

export default function AddressRow({ customerId, a, onReload }) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ label: a.label, type: a.type, line1: a.line1, line2: a.line2 || '', city: a.city, postcode: a.postcode });

  const setDefault = async () => { setBusy(true); await setDefaultAddress(customerId, a.id); setBusy(false); onReload?.(); };
  const save = async () => { setBusy(true); await updateAddress(customerId, a.id, form); setBusy(false); setEditing(false); onReload?.(); };

  const fieldStyle = { borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 10, backgroundColor: '#fff' };

  if (editing) {
    return (
      <Card style={{ marginBottom: 10, backgroundColor: t.light }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {Object.entries(ADDRESS_TYPES).map(([k, ty]) => (
            <Pressable key={k} onPress={() => setForm((f) => ({ ...f, type: k }))} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: form.type === k ? 2 : 1.5, borderColor: form.type === k ? t.navy : t.gray3, backgroundColor: form.type === k ? t.navy : '#fff' }}>
              <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: form.type === k ? '#fff' : t.gray }}>{ty.icon} {ty.label}</Text>
            </Pressable>
          ))}
        </View>
        {form.type === 'other' && <TextInput placeholder="Label" value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} style={fieldStyle} />}
        <TextInput placeholder="Address line 1" value={form.line1} onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))} style={fieldStyle} />
        <TextInput placeholder="Address line 2 (unit no., etc.)" value={form.line2} onChangeText={(v) => setForm((f) => ({ ...f, line2: v }))} style={fieldStyle} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TextInput placeholder="City" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} style={[fieldStyle, { flex: 1, marginBottom: 0 }]} />
          <TextInput placeholder="Postcode" value={form.postcode} onChangeText={(v) => setForm((f) => ({ ...f, postcode: v }))} style={[fieldStyle, { flex: 1, marginBottom: 0 }]} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button sm variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }}>Cancel</Button>
          <Button sm variant="lime" disabled={busy} onPress={save} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Save'}</Button>
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: satoshi(700) }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label}</Text>
        {a.is_default ? <Chip variant="gray">default</Chip> : null}
      </View>
      <Text style={{ fontSize: 13, color: t.gray, marginTop: 2 }}>{a.line1}, {a.city} {a.postcode}</Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        {!a.is_default && <Pressable onPress={setDefault} disabled={busy}><Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>{busy ? 'Setting…' : 'Set as default'}</Text></Pressable>}
        <Pressable onPress={() => setEditing(true)}><Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>Edit</Text></Pressable>
      </View>
    </Card>
  );
}
