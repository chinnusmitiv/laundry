import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import {
  Sheet, Card, Chip, StatusPill, Button, GarmentJourney, OneMap, PaymentSheet, Empty,
  useTheme, satoshi, fmt, STATUS_FLOW, STATUS_LABEL, HANDOVER, GARMENT_LABEL, distKm, etaMins, downloadInvoice, PICKUP_SLOTS,
} from '@chaselaundry/shared-native';
import Loading from '../components/Loading';
import { getOrder, payOrder, submitReview, createPaymentIntent, cancelOrder, rescheduleOrder } from '../lib/api';

const CANCELLABLE_STATUSES = ['placed', 'assigned', 'driver_en_route'];

export default function OrderDetailSheet({ orderId, onClose }) {
  const t = useTheme();
  const [o, setO] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newSlot, setNewSlot] = useState(null);
  const [savingSlot, setSavingSlot] = useState(false);

  const reload = useCallback(() => { if (orderId) getOrder(orderId).then(setO); }, [orderId]);
  useEffect(() => { setO(null); setConfirmCancel(false); setRescheduling(false); if (orderId) reload(); }, [orderId, reload]);

  // poll for status updates while the sheet is open (native stand-in for web's socket push)
  useEffect(() => {
    if (!orderId) return;
    const iv = setInterval(reload, 3000);
    return () => clearInterval(iv);
  }, [orderId, reload]);

  const enRoute = o && ['driver_en_route', 'out_for_delivery'].includes(o.status) && o.address;

  if (!orderId) return null;
  const driver = o?.location;
  const km = driver?.lat && o?.address?.lat ? distKm(driver, o.address) : null;
  const etaMin = etaMins(km);
  // matches server's /api/orders/:id/pay: an authorized hold settles for the held
  // amount (which can drift from the order's current total after an edit), everything
  // else charges the order's current total.
  const payAmount = o ? (o.payment_status === 'authorized' ? (o.hold_amount_cents ?? o.total_cents) : o.total_cents) : 0;

  return (
    <Sheet open={!!orderId} onClose={onClose} title={o ? o.code : 'Loading…'}>
      {!o ? <Loading /> : (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <StatusPill status={o.status} label={o.status_label} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: satoshi(900) }}>{fmt.money(o.total_cents)}</Text>
              <PayChip status={o.payment_status} />
            </View>
          </View>

          {enRoute && (
            <View style={{ marginBottom: 14 }}>
              <OneMap driver={driver} dest={o.address} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: t.ok }} />
                  <Text style={{ fontFamily: satoshi(700) }}>{o.driver?.name?.split(' ')[0] || 'Driver'}</Text>
                  <Text style={{ color: t.gray, fontSize: 13 }}>{km != null ? `· ${km.toFixed(1)} km away` : '· on the way'}</Text>
                </View>
                {etaMin != null && <Text style={{ fontFamily: satoshi(900), fontSize: 14 }}>~{etaMin} min</Text>}
              </View>
            </View>
          )}

          {o.transfer
            ? <Text style={{ fontSize: 12, marginBottom: 12, color: t.navy, fontFamily: satoshi(700) }}>🚚 Moving to our {o.transfer.to?.name} for specialist care</Text>
            : o.facility && <Text style={{ color: t.gray, fontSize: 12, marginBottom: 12 }}>🏭 Processed at {o.facility.name}, {o.facility.area}</Text>}

          {o.handover && HANDOVER[o.handover] && (
            <Card style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ fontSize: 20 }}>{HANDOVER[o.handover].icon}</Text>
                <View>
                  <Eyebrow>Pickup</Eyebrow>
                  <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{HANDOVER[o.handover].label}</Text>
                  {!!o.handover_contact && <Text style={{ color: t.gray, fontSize: 12 }}>{o.handover_contact}</Text>}
                </View>
              </View>
            </Card>
          )}

          {!!o.notes && (
            <Card style={{ marginBottom: 14, backgroundColor: t.accentPale, borderWidth: 1.5, borderColor: t.accentD, borderStyle: 'dashed' }}>
              <Eyebrow style={{ color: t.navy }}>Special Instructions / Garment Notes</Eyebrow>
              <Text style={{ fontSize: 13, color: t.navy, marginTop: 4, fontStyle: 'italic' }}>“{o.notes}”</Text>
            </Card>
          )}

          <Card style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 12 }}>Progress</Eyebrow>
            <Timeline status={o.status} />
          </Card>

          {o.garments?.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <Eyebrow style={{ marginBottom: 10 }}>Item tracking ({o.garments.length})</Eyebrow>
              {o.garments.map((g) => <GarmentCard key={g.id} g={g} />)}
            </Card>
          )}

          <Card style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 10 }}>Receipt</Eyebrow>
            {o.items.map((i) => <Line key={i.id} l={i.name + (i.weight_kg ? ` (${i.weight_kg}kg)` : i.qty > 1 ? ` ×${i.qty}` : '')} v={fmt.money(i.price_cents)} />)}
            <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 10 }} />
            <Line l="Subtotal" v={fmt.money(o.subtotal_cents)} />
            <Line l="Service fee" v={o.platform_fee_cents ? fmt.money(o.platform_fee_cents) : 'WAIVED'} />
            <Line l="Delivery" v={o.delivery_fee_cents ? fmt.money(o.delivery_fee_cents) : 'FREE'} />
            {o.discount_cents > 0 && <Line l="Plan discount" v={`– ${fmt.money(o.discount_cents)}`} green />}
            {o.pack_credit_cents > 0 && <Line l="Covered by prepaid pack" v={`– ${fmt.money(o.pack_credit_cents)}`} green />}
            {o.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(o.credit_applied_cents)}`} green />}
            {o.tip_cents > 0 && <Line l="Driver tip" v={fmt.money(o.tip_cents)} />}
            <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 10 }} />
            <Line l="Total" v={fmt.money(o.total_cents)} bold />
          </Card>

          {o.payment_status === 'authorized' && o.status !== 'cancelled' && (
            <Card style={{ marginBottom: 10, backgroundColor: t.accentPale }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ fontSize: 20 }}>💳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: satoshi(800), fontSize: 14 }}>{fmt.money(o.hold_amount_cents || o.total_cents)} held on your card</Text>
                  <Text style={{ color: t.gray, fontSize: 12 }}>You're only charged once your order is delivered — or pay now below.</Text>
                </View>
              </View>
            </Card>
          )}
          {['pending', 'voided', 'authorized'].includes(o.payment_status) && o.status !== 'cancelled' && (
            <View style={{ marginBottom: 10 }}><Button variant="lime" onPress={() => setPayOpen(true)}>Pay {fmt.money(payAmount)}</Button></View>
          )}

          <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} amountCents={payAmount}
            title="Complete payment" description={o.code} createPaymentIntent={createPaymentIntent}
            onAuthorized={async (paymentIntentId) => { await payOrder(o.id, paymentIntentId); reload(); }} />

          {CANCELLABLE_STATUSES.includes(o.status) && (
            rescheduling ? (
              <Card style={{ marginBottom: 10 }}>
                <Text style={{ fontFamily: satoshi(700), fontSize: 14, marginBottom: 10 }}>Pick a new collection slot</Text>
                {PICKUP_SLOTS.map((s) => (
                  <Pressable key={s} onPress={() => setNewSlot(s)} style={{ paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1.5, borderColor: newSlot === s ? t.navy : t.gray3 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{s}</Text>
                      {newSlot === s && <Text>✓</Text>}
                    </View>
                  </Pressable>
                ))}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Button sm variant="ghost" onPress={() => { setRescheduling(false); setNewSlot(null); }} style={{ flex: 1 }}>Cancel</Button>
                  <Button sm variant="lime" disabled={!newSlot || savingSlot} onPress={async () => {
                    setSavingSlot(true);
                    try { await rescheduleOrder(o.id, newSlot); setRescheduling(false); setNewSlot(null); await reload(); }
                    finally { setSavingSlot(false); }
                  }} style={{ flex: 1 }}>{savingSlot ? 'Saving…' : 'Confirm new slot'}</Button>
                </View>
              </Card>
            ) : (
              <View style={{ marginBottom: 10 }}><Button variant="ghost" onPress={() => { setRescheduling(true); setNewSlot(o.pickup_slot); }}>Reschedule pickup</Button></View>
            )
          )}

          {CANCELLABLE_STATUSES.includes(o.status) && (
            confirmCancel ? (
              <Card style={{ marginBottom: 10, backgroundColor: 'rgba(239,68,68,.08)' }}>
                <Text style={{ fontFamily: satoshi(700), fontSize: 14, marginBottom: 10 }}>Cancel this order? Any card hold will be released.</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button sm variant="ghost" onPress={() => setConfirmCancel(false)} style={{ flex: 1 }}>No, keep it</Button>
                  <Button sm disabled={cancelling} onPress={async () => {
                    setCancelling(true);
                    try { await cancelOrder(o.id); setConfirmCancel(false); await reload(); }
                    finally { setCancelling(false); }
                  }} style={{ flex: 1, backgroundColor: t.danger }}>{cancelling ? 'Cancelling…' : 'Yes, cancel order'}</Button>
                </View>
              </Card>
            ) : (
              <View style={{ marginBottom: 10 }}><Button variant="ghost" onPress={() => setConfirmCancel(true)}>Cancel order</Button></View>
            )
          )}

          {o.status === 'completed' && <View style={{ marginBottom: 10 }}><Button variant="ghost" onPress={() => setReviewOpen(true)}>★ Rate this order</Button></View>}

          <View style={{ marginBottom: 10 }}><Button variant="ghost" onPress={() => downloadInvoice(o)}>🧾 Download invoice</Button></View>
          <View style={{ marginBottom: 10 }}><Button variant="ghost" onPress={onClose}>Close</Button></View>

          <ReviewSheet open={reviewOpen} onClose={() => setReviewOpen(false)} order={o} />
        </View>
      )}
    </Sheet>
  );
}

function GarmentCard({ g }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.gray3 }}>
      <Pressable onPress={() => setOpen((x) => !x)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{g.type} <Text style={{ color: t.gray, fontFamily: undefined }}>· {g.color}</Text></Text>
          <Text style={{ fontSize: 11, color: t.gray }}>🏷️ {g.tag_code}{g.care ? ` · ${g.care}` : ''}</Text>
        </View>
        <Chip variant={g.status === 'returned' || g.status === 'packed' ? 'navy' : undefined}>{GARMENT_LABEL[g.status] || g.status}</Chip>
      </Pressable>
      <View style={{ marginTop: 10 }}>
        <GarmentJourney garment={g} compact={!open} fmtTime={fmt.time} />
      </View>
      {!open && <Pressable onPress={() => setOpen(true)}><Text style={{ fontSize: 11, color: t.navy, fontFamily: satoshi(700), marginTop: 6 }}>View journey ↓</Text></Pressable>}
    </View>
  );
}

function Timeline({ status }) {
  const t = useTheme();
  const idx = STATUS_FLOW.indexOf(status);
  const visible = ['placed', 'driver_en_route', 'picked_up', 'processing', 'out_for_delivery', 'completed'];
  return (
    <View>
      {visible.map((s) => {
        const done = STATUS_FLOW.indexOf(s) <= idx;
        const current = s === status || (s === 'processing' && ['at_facility', 'confirmed', 'ready'].includes(status)) || (s === 'completed' && status === 'delivered');
        return (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
            <View style={{ width: 22, height: 22, borderRadius: 22, backgroundColor: done ? t.accent : t.gray3, alignItems: 'center', justifyContent: 'center' }}>
              {done && <Text style={{ fontSize: 12, color: t.onAccentText, fontFamily: satoshi(900) }}>✓</Text>}
            </View>
            <Text style={{ fontFamily: current ? satoshi(800) : satoshi(600), color: done ? t.navy : t.gray2 }}>{STATUS_LABEL[s]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewSheet({ open, onClose, order }) {
  const t = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const submit = async () => { await submitReview(order.id, { rating, comment, google_linked: true }); setDone(true); };
  return (
    <Sheet open={open} onClose={onClose} title="Rate your order">
      {done ? <Empty icon="💚" title="Thanks ah, you the best!" sub="Your review helps us grow." /> : (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={{ fontSize: 38, opacity: n <= rating ? 1 : 0.25 }}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            multiline numberOfLines={3} placeholder="Tell us how we did…" value={comment} onChangeText={setComment}
            style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, minHeight: 76, textAlignVertical: 'top' }}
          />
          <Button variant="lime" onPress={submit}>Submit review</Button>
        </View>
      )}
    </Sheet>
  );
}

function Eyebrow({ children, style }) {
  const t = useTheme();
  return <Text style={[{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2 }, style]}>{children}</Text>;
}
function Line({ l, v, green, bold }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: t.gray, fontSize: 14, fontFamily: bold ? satoshi(800) : undefined }}>{l}</Text>
      <Text style={{ color: green ? t.ok : t.text, fontFamily: green || bold ? satoshi(700) : undefined, fontSize: bold ? 15 : 14 }}>{v}</Text>
    </View>
  );
}
function PayChip({ status }) {
  const map = { paid: ['paid', 'navy'], authorized: ['on hold', 'gray'], voided: ['released', 'gray'], invoiced: ['invoiced', 'gray'] };
  const [label, variant] = map[status] || ['unpaid', 'gray'];
  return <Chip variant={variant}>{label}</Chip>;
}
