import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Card, Chip, Button, Sheet, Field, Empty, useTheme, satoshi, fmt, TICKET_CATEGORIES } from '@chaselaundry/shared-native';
import Loading from '../components/Loading';
import { getThreads, createThread, getThread, sendThreadMessage, getOrders } from '../lib/api';

export default function SupportScreen({ customer }) {
  const t = useTheme();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = () => getThreads(customer.id).then(setThreads);
  useEffect(() => { load(); }, []);

  if (active) return <Chat threadId={active} customer={customer} onBack={() => { setActive(null); load(); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.light }}>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 22, fontFamily: satoshi(900) }}>Support</Text>
          <Button sm variant="lime" onPress={() => setNewOpen(true)}>+ New ticket</Button>
        </View>
        <Card style={{ marginBottom: 14, backgroundColor: t.accentPale }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>💬</Text>
            <View>
              <Text style={{ fontFamily: satoshi(800) }}>We reply fast one</Text>
              <Text style={{ fontSize: 12, color: t.gray }}>Real humans, 7am–11pm daily. Just ask ah!</Text>
            </View>
          </View>
        </Card>
        {threads.length === 0 ? <Empty icon="💬" title="No tickets yet" sub="Got problem? Raise a ticket lah" /> :
          threads.map((th) => (
            <Card key={th.id} onPress={() => setActive(th.id)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: satoshi(800) }}>{th.subject}</Text>
                <Chip variant={th.status === 'open' ? undefined : 'gray'}>{th.status.replace('_', ' ')}</Chip>
              </View>
              <Text style={{ fontSize: 12, color: t.gray, marginTop: 4 }}>Updated {fmt.ago(th.updated_at)}</Text>
            </Card>
          ))}
      </ScrollView>
      <NewTicketSheet open={newOpen} onClose={() => setNewOpen(false)} customer={customer} onCreated={(th) => { setNewOpen(false); load(); setActive(th.id); }} />
    </View>
  );
}

function NewTicketSheet({ open, onClose, customer, onCreated }) {
  const t = useTheme();
  const [cat, setCat] = useState('order');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCat('order'); setSubject(''); setMessage(''); setOrderId(''); setBusy(false);
      getOrders(customer.id).then(setOrders);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    const c = TICKET_CATEGORIES.find((x) => x.key === cat);
    const ord = orders.find((o) => o.id === orderId);
    const th = await createThread(customer.id, {
      subject: `${c.icon} ${c.label}${ord ? ` · ${ord.code}` : ''}${subject.trim() ? ` · ${subject.trim()}` : ''}`,
      order_id: orderId || undefined,
      body: message.trim() || undefined,
    });
    setBusy(false); onCreated(th);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Raise a support ticket">
      <Text style={{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2, marginBottom: 8 }}>What's it about?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {TICKET_CATEGORIES.map((c) => (
          <Pressable key={c.key} onPress={() => setCat(c.key)} style={{ width: '47%', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: cat === c.key ? 2 : 1.5, borderColor: cat === c.key ? t.navy : t.gray3, backgroundColor: cat === c.key ? t.navy : '#fff' }}>
            <Text style={{ fontFamily: satoshi(700), fontSize: 13, color: cat === c.key ? '#fff' : t.gray }}>{c.icon} {c.label}</Text>
          </Pressable>
        ))}
      </View>

      {orders.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>Related order (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => setOrderId('')} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: orderId === '' ? t.navy : t.gray3 }}>
              <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: orderId === '' ? '#fff' : t.gray }}>None</Text>
            </Pressable>
            {orders.map((o) => (
              <Pressable key={o.id} onPress={() => setOrderId(o.id)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: orderId === o.id ? t.navy : t.gray3 }}>
                <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: orderId === o.id ? '#fff' : t.gray }}>{o.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Field label="Subject (optional)" placeholder="Short summary…" value={subject} onChangeText={setSubject} />
      <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>How can we help?</Text>
      <TextInput
        multiline numberOfLines={4} placeholder="Tell us what happened…" value={message} onChangeText={setMessage}
        style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14, minHeight: 96, textAlignVertical: 'top' }}
      />
      <Button variant="lime" disabled={busy || !message.trim()} onPress={submit}>{busy ? 'Creating…' : 'Submit ticket'}</Button>
      <Text style={{ color: t.gray, fontSize: 12, textAlign: 'center', marginTop: 10 }}>Our support team replies right here in chat.</Text>
    </Sheet>
  );
}

function Chat({ threadId, customer, onBack }) {
  const t = useTheme();
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');

  const load = () => getThread(threadId).then(setThread);
  useEffect(() => { load(); const iv = setInterval(load, 3000); return () => clearInterval(iv); }, [threadId]);

  const send = async () => {
    if (!text.trim()) return;
    await sendThreadMessage(threadId, { sender_role: 'customer', sender_id: customer.id, body: text });
    setText(''); load();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.light }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: t.gray3, backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onBack} style={{ marginRight: 12 }}><Text style={{ fontSize: 20 }}>←</Text></Pressable>
          <View>
            <Text style={{ fontFamily: satoshi(800) }}>{thread?.subject || 'Support'}</Text>
            <Text style={{ fontSize: 11, color: t.gray }}>ChaseLaundry Support</Text>
          </View>
        </View>
        {!!thread?.status && <Chip variant={thread.status === 'open' ? undefined : 'gray'}>{thread.status.replace('_', ' ')}</Chip>}
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }}>
        {thread?.messages?.map((m) => {
          if (m.sender_role === 'system') {
            return (
              <Text key={m.id} style={{ alignSelf: 'center', fontSize: 12, color: t.gray, fontStyle: 'italic', backgroundColor: t.gray3, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 }}>{m.body}</Text>
            );
          }
          const mine = m.sender_role === 'customer';
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <View style={{ backgroundColor: mine ? t.navy : '#fff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, ...t.shadowSm }}>
                <Text style={{ color: mine ? '#fff' : t.text, fontSize: 14 }}>{m.body}</Text>
              </View>
              <Text style={{ fontSize: 10, color: t.gray, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>{m.sender_role === 'ops' ? 'Support' : 'You'} · {fmt.time(m.created_at)}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: t.gray3, backgroundColor: '#fff' }}>
        <TextInput
          placeholder="Message…" value={text} onChangeText={setText} onSubmitEditing={send}
          style={{ flex: 1, borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 12, fontSize: 15 }}
        />
        <Button sm variant="lime" onPress={send}>Send</Button>
      </View>
    </KeyboardAvoidingView>
  );
}
