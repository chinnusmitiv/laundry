import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Linking, TextInput } from 'react-native';
import * as Print from 'expo-print';
import QRCode from 'react-native-qrcode-svg';
import {
  Sheet, Card, Chip, StatusPill, Avatar, Button, Eyebrow, OneMap, useTheme, fmt, satoshi, GARMENT_LABEL,
} from '@chaselaundry/shared-native';
import {
  getOrder, setOrderStatus, pushLocation, simulateDrive, getReviewLink, generateTags, advanceByTag, ACTIONS, HANDOVER,
} from '../lib/api';
import { getPos } from '../lib/location';

export default function JobDetailSheet({ jobId, onClose }) {
  const t = useTheme();
  const [job, setJob] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!jobId) return;
    getOrder(jobId).then((o) => { setJob(o); setDriverLoc(o.location); });
  }, [jobId]);

  useEffect(() => { setJob(null); if (jobId) reload(); }, [jobId, reload]);

  if (!jobId) return null;
  const a = job && ACTIONS[job.status];

  const advance = async () => {
    setBusy(true);
    try {
      if (a.next === 'driver_en_route') {
        const pos = await getPos();
        await pushLocation(job.driver_id, { ...pos, order_id: jobId });
      }
      setJob(await setOrderStatus(jobId, a.next));
    } finally { setBusy(false); }
  };

  const pingLocation = async () => {
    const r = await simulateDrive(jobId);
    setDriverLoc(r.location);
  };

  const markComplete = async () => { setJob(await setOrderStatus(jobId, 'completed')); };

  return (
    <Sheet open={!!jobId} onClose={onClose} title={job ? job.code : 'Loading…'}>
      {!job ? null : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <StatusPill status={job.status} label={job.status_label} />
            <Chip variant={job.payment_status === 'paid' ? 'navy' : 'gray'}>{job.payment_status}</Chip>
          </View>

          <Card style={{ marginBottom: 14 }}>
            <Eyebrow>Customer</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 12 }}>
              <Avatar name={job.customer?.name} size={44} />
              <View>
                <Text style={{ fontFamily: satoshi(800) }}>{job.customer?.name}</Text>
                <Text style={{ color: t.gray, fontSize: 13 }}>{job.customer?.phone}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: t.light, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>📍 {job.address?.label}</Text>
              <Text style={{ color: t.gray, fontSize: 13, marginTop: 2 }}>
                {job.address?.line1}{job.address?.line2 ? `, ${job.address.line2}` : ''}, {job.address?.city} {job.address?.postcode}
              </Text>
            </View>
            {job.handover && HANDOVER[job.handover] && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, backgroundColor: t.accentPale, borderWidth: 1.5, borderColor: t.accentD, borderRadius: 12, padding: 12 }}>
                <Text style={{ fontSize: 20 }}>{HANDOVER[job.handover].icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: satoshi(800), fontSize: 14, color: t.navy }}>{HANDOVER[job.handover].label}</Text>
                  <Text style={{ fontSize: 12, color: t.navy, opacity: 0.75 }}>{job.handover_contact || HANDOVER[job.handover].sub}</Text>
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button sm variant="ghost" style={{ flex: 1 }} onPress={() => job.customer?.phone && Linking.openURL(`tel:${job.customer.phone}`)}>📞 Call</Button>
              <Button sm variant="ghost" style={{ flex: 1 }} onPress={() => job.address?.lat && Linking.openURL(`https://maps.google.com/?q=${job.address.lat},${job.address.lng}`)}>🧭 Navigate</Button>
            </View>
            {!!job.notes && <Text style={{ marginTop: 12, fontSize: 13, fontStyle: 'italic', color: t.gray }}>“{job.notes}”</Text>}
          </Card>

          {['driver_en_route', 'out_for_delivery'].includes(job.status) && job.address && (
            <Card style={{ marginBottom: 14 }}>
              <OneMap driver={driverLoc} dest={job.address} height={170} />
              <View style={{ marginTop: 10 }}>
                <Button sm variant="ghost" onPress={pingLocation}>📡 Send location update</Button>
              </View>
            </Card>
          )}

          {job.facility && (
            <Card style={{ marginBottom: 14, backgroundColor: t.navy }}>
              <Eyebrow style={{ color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>
                {['picked_up', 'at_facility'].includes(job.status) ? 'Drop off at' : 'Processing warehouse'}
              </Eyebrow>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: satoshi(800), fontSize: 15, color: '#fff' }}>
                    🏭 {job.facility.name} <Text style={{ color: t.accent, fontSize: 12 }}>{job.facility.code}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{job.facility.line1}, {job.facility.postcode}</Text>
                </View>
                <Button sm variant="lime" onPress={() => Linking.openURL(`https://maps.google.com/?q=${job.facility.lat},${job.facility.lng}`)}>🧭 Navigate</Button>
              </View>
            </Card>
          )}

          <Card style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Items · {fmt.money(job.total_cents)}</Eyebrow>
            {job.items.map((i) => (
              <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 14 }}>{i.name}{i.weight_kg ? ` (${i.weight_kg}kg)` : i.qty > 1 ? ` ×${i.qty}` : ''}</Text>
                <Text style={{ fontSize: 14, color: t.gray }}>{fmt.money(i.price_cents)}</Text>
              </View>
            ))}
          </Card>

          <TagCard job={job} />

          {a && <Button variant="lime" style={{ marginBottom: 10 }} disabled={busy} onPress={advance}>{busy ? '…' : a.label}</Button>}

          {['delivered', 'completed'].includes(job.status) && (
            <>
              <Button variant="navy" style={{ marginBottom: 10 }} onPress={() => setQrOpen(true)}>★ Request Google review</Button>
              {job.status === 'delivered' && <Button variant="ghost" style={{ marginBottom: 10 }} onPress={markComplete}>Mark complete</Button>}
            </>
          )}

          <Button variant="ghost" onPress={onClose}>Close</Button>
          <ReviewQR open={qrOpen} onClose={() => setQrOpen(false)} orderId={jobId} />
        </>
      )}
    </Sheet>
  );
}

// ── garment tags: print QR tags + scan to advance status
function TagCard({ job }) {
  const t = useTheme();
  const [scan, setScan] = useState('');
  const [msg, setMsg] = useState('');
  const [printing, setPrinting] = useState(false);

  const printTags = async () => {
    setPrinting(true);
    try {
      const tags = await generateTags(job.id);
      const cards = tags.map((tg) => `
        <div style="display:inline-flex;flex-direction:column;align-items:center;border:1.5px solid #1D2951;border-radius:12px;padding:12px;margin:6px;width:170px;font-family:-apple-system,sans-serif">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tg.tag_code)}" width="140" height="140"/>
          <div style="font-weight:800;margin-top:6px;color:#1D2951">${tg.tag_code}</div>
          <div style="font-size:11px;color:#555">${tg.type || ''}</div>
          <div style="font-size:9px;color:#999;letter-spacing:1px">CHASELAUNDRY</div>
        </div>`).join('');
      await Print.printAsync({ html: `<html><body style="text-align:center">${cards}</body></html>` });
    } finally { setPrinting(false); }
  };

  const doScan = async () => {
    const code = scan.trim().toUpperCase();
    if (!code) return;
    try {
      const g = await advanceByTag(code);
      setMsg(`✓ ${g.tag_code} → ${GARMENT_LABEL[g.status] || g.status}`);
      setScan('');
    } catch { setMsg(`✗ ${code} not found`); }
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <Eyebrow style={{ marginBottom: 10 }}>🏷️ Garment tags</Eyebrow>
      <View style={{ marginBottom: 10 }}>
        <Button sm variant="ghost" disabled={printing} onPress={printTags}>
          {printing ? 'Preparing…' : `🖨️ Print tags (${job.items?.length || 0} item${job.items?.length === 1 ? '' : 's'})`}
        </Button>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 }}
          placeholder="Scan / type tag e.g. CL-1042-01"
          autoCapitalize="characters"
          value={scan}
          onChangeText={setScan}
          onSubmitEditing={doScan}
        />
        <Button sm variant="lime" onPress={doScan}>Scan</Button>
      </View>
      {!!msg && <Text style={{ fontSize: 13, fontFamily: satoshi(700), marginTop: 8, color: msg[0] === '✓' ? t.ok : t.danger }}>{msg}</Text>}
    </Card>
  );
}

// ── QR code linking to a Google review page
function ReviewQR({ open, onClose, orderId }) {
  const t = useTheme();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    getReviewLink(orderId).then((r) => setUrl(r.url));
  }, [open, orderId]);

  return (
    <Sheet open={open} onClose={onClose} title="Show this to the customer" scroll={false}>
      <View style={{ alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 14, color: t.gray, marginBottom: 16, textAlign: 'center' }}>Loved the service? Scan to leave us a Google review ⭐</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, ...t.shadowSm }}>
          {url ? <QRCode value={url} size={240} color={t.navy} backgroundColor="#fff" /> : <View style={{ width: 240, height: 240, backgroundColor: t.gray3, borderRadius: 8 }} />}
        </View>
        <Text style={{ fontSize: 11, color: t.gray, marginTop: 14, textAlign: 'center' }}>{url}</Text>
        <View style={{ width: '100%', marginTop: 16 }}>
          <Button variant="lime" onPress={onClose}>Done</Button>
        </View>
      </View>
    </Sheet>
  );
}
