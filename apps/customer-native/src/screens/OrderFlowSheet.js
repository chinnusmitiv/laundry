import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import {
  Sheet, Card, Button, Switch, PaymentSheet, useTheme, satoshi, fmt,
  HANDOVER, ADDRESS_TYPES, REPEAT_CADENCE, PICKUP_SLOTS, etaLabel,
} from '@chaselaundry/shared-native';
import ServicePicker from '../components/ServicePicker';
import AddAddress from '../components/AddAddress';
import Loading from '../components/Loading';
import {
  getCatalog, getPlans, quoteOrder, placeOrder, activateSubscription, confirmPayment,
} from '../lib/api';

export default function OrderFlowSheet({ open, seed, customer, summary, onClose, onPlaced }) {
  const t = useTheme();
  const wasOpen = useRef(false);
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [cart, setCart] = useState({});
  const [slot, setSlot] = useState(PICKUP_SLOTS[0]);
  const [useCredit, setUseCredit] = useState(true);
  const [quote, setQuote] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addrId, setAddrId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');
  const [handover, setHandover] = useState('hand_to_me');
  const [handoverContact, setHandoverContact] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [repeatCadence, setRepeatCadence] = useState('weekly');
  const [tipCents, setTipCents] = useState(0);
  const [chargesInfoOpen, setChargesInfoOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [upsellPlan, setUpsellPlan] = useState(null);
  const [payPlan, setPayPlan] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [skipItemStep, setSkipItemStep] = useState(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      getCatalog().then(setCatalog); getPlans().then(setPlans);
      setStep(seed?.step || 1); setCart(seed?.cart || {}); setSkipItemStep(!!(seed?.cart && Object.keys(seed.cart).length));
      setAdding(false); setNotes(''); setHandover('hand_to_me'); setHandoverContact(''); setRepeat(false); setRepeatCadence('weekly');
      setTipCents(0); setChargesInfoOpen(false); setUpsellPlan(null); setPayPlan(null); setPromoCode(''); setPromoMsg('');
      const addrs = summary?.addresses || [];
      setAddresses(addrs); setAddrId((addrs.find((a) => a.is_default) || addrs[0])?.id || null);
    }
    wasOpen.current = open;
  }, [open, summary, seed]);

  const onAddrSaved = (a) => { setAddresses((list) => [...list, a]); setAddrId(a.id); setAdding(false); };

  const items = Object.entries(cart).filter(([, v]) => (v.qty || v.weight) > 0).map(([catalog_id, v]) => ({ catalog_id, qty: v.qty, weight_kg: v.weight }));

  useEffect(() => {
    if (step === 3 && items.length) quoteOrder({ customer_id: customer.id, items, use_credit: useCredit }).then(setQuote);
    // eslint-disable-next-line
  }, [step, useCredit]);

  const place = async () => {
    setPlacing(true);
    const o = await placeOrder({
      customer_id: customer.id, address_id: addrId, items,
      pickup_slot: slot, return_slot: 'Thu · 18:00–20:00', use_credit: useCredit, notes: notes.trim(),
      handover, handover_contact: handover === 'someone_else' ? handoverContact : null,
      repeat_requested: repeat, repeat_cadence: repeat ? repeatCadence : null, tip_cents: tipCents,
    });
    setPlacing(false); onPlaced(o);
  };

  const activatePlan = (plan_id) => activateSubscription(customer.id, plan_id);

  const placeWithUpsell = async () => {
    if (upsellPlan) {
      const plan = plans.find((p) => p.id === upsellPlan);
      if (plan?.price_cents) { setPayPlan(plan); return; }
      await activatePlan(upsellPlan);
    }
    await place();
  };

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  return (
    <Sheet open={open} onClose={onClose} title={`Schedule pickup · Step ${step}/3`}>
      {step === 1 && (
        <View>
          <Text style={{ color: t.gray, fontSize: 13, marginBottom: 14 }}>When should we collect?</Text>
          {PICKUP_SLOTS.map((s) => (
            <Card key={s} onPress={() => setSlot(s)} style={{ marginBottom: 10, borderWidth: 2, borderColor: slot === s ? t.navy : 'transparent' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: satoshi(700) }}>{s}</Text>
                {slot === s && <Text>✓</Text>}
              </View>
            </Card>
          ))}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <Eyebrow>Pickup address</Eyebrow>
            <Pressable onPress={() => setAdding((x) => !x)}><Text style={{ fontSize: 12, fontFamily: satoshi(800), color: t.navy }}>{adding ? 'Cancel' : '+ Add'}</Text></Pressable>
          </View>
          {adding && <AddAddress customerId={customer.id} onSaved={onAddrSaved} onCancel={() => setAdding(false)} />}
          {addresses.map((a) => (
            <Card key={a.id} onPress={() => setAddrId(a.id)} style={{ marginBottom: 10, borderWidth: 2, borderColor: addrId === a.id ? t.navy : 'transparent' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontFamily: satoshi(700) }}>{ADDRESS_TYPES[a.type]?.icon || '📍'} {a.label}</Text>
                  <Text style={{ fontSize: 13, color: t.gray }}>{a.line1}, {a.postcode}</Text>
                </View>
                {addrId === a.id && <Text>✓</Text>}
              </View>
            </Card>
          ))}

          <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>How should we collect?</Eyebrow>
          {Object.entries(HANDOVER).map(([key, h]) => (
            <Card key={key} onPress={() => setHandover(key)} style={{ marginBottom: 10, borderWidth: 2, borderColor: handover === key ? t.navy : 'transparent' }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>{h.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: satoshi(700) }}>{h.label}</Text>
                  <Text style={{ fontSize: 12, color: t.gray }}>{h.sub}</Text>
                </View>
                {handover === key && <Text>✓</Text>}
              </View>
            </Card>
          ))}
          {handover === 'someone_else' && (
            <TextInput
              placeholder="Their name & phone (e.g. Mum · 9123 4567)" value={handoverContact} onChangeText={setHandoverContact}
              style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, marginTop: 2 }}
            />
          )}

          <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Special Instructions / Garment Notes</Eyebrow>
          <TextInput
            multiline numberOfLines={3} placeholder="E.g., 2 Oxford shirts (White/Blue), tumble dry low for chinos..."
            value={notes} onChangeText={setNotes}
            style={{ borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, minHeight: 76, textAlignVertical: 'top' }}
          />

          <Card style={{ marginBottom: 14 }}>
            <Pressable onPress={() => setRepeat((x) => !x)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: satoshi(700) }}>🔁 Repeat this order</Text>
              <Switch value={repeat} onChange={setRepeat} />
            </Pressable>
            {repeat && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {Object.entries(REPEAT_CADENCE).map(([k, c]) => (
                  <Button key={k} sm variant={repeatCadence === k ? 'lime' : 'ghost'} onPress={() => setRepeatCadence(k)} style={{ flex: 1 }}>{c.label}</Button>
                ))}
              </View>
            )}
          </Card>

          <Button variant="lime" disabled={!addrId} onPress={() => setStep(skipItemStep ? 3 : 2)}>Next</Button>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={{ color: t.gray, fontSize: 13, marginBottom: 14 }}>What needs cleaning?</Text>
          <ServicePicker catalog={catalog} cart={cart} setCart={setCart} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button variant="ghost" onPress={() => setStep(1)} style={{ flex: 1 }}>Back</Button>
            <Button variant="lime" disabled={!items.length} onPress={() => setStep(3)} style={{ flex: 1 }}>Next</Button>
          </View>
        </View>
      )}

      {step === 3 && (
        !quote ? <Loading /> : (
          <View>
            <Text style={{ fontFamily: satoshi(900), fontSize: 18, marginBottom: 4 }}>Review & confirm</Text>
            <Text style={{ color: t.gray, fontSize: 12, marginBottom: 12 }}>💳 We hold this on your card now and only charge it when your order's delivered.</Text>
            <Card style={{ marginBottom: 14 }}>
              <Line l="Subtotal" v={fmt.money(quote.subtotal_cents)} />
              <Line l="Service fee" v={quote.platform_fee_cents ? fmt.money(quote.platform_fee_cents) : 'WAIVED'} />
              <Line l="Collection & Delivery" v={quote.delivery_fee_cents ? fmt.money(quote.delivery_fee_cents) : 'FREE'} />
              {quote.pack_credit_cents > 0 && <Line l="Covered by prepaid pack" v={`– ${fmt.money(quote.pack_credit_cents)}`} green />}
              {quote.credit_applied_cents > 0 && <Line l="Wallet credit" v={`– ${fmt.money(quote.credit_applied_cents)}`} green />}
              {tipCents > 0 && <Line l="Driver tip" v={fmt.money(tipCents)} />}
              <Pressable onPress={() => setChargesInfoOpen((x) => !x)} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.navy }}>How charges work?</Text>
              </Pressable>
              {chargesInfoOpen && (
                <Text style={{ color: t.gray, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                  We place a hold on your card at checkout and only capture it once your order is delivered. Priced per kg or item; the service fee covers collection & delivery — waived on Plus/Pro. Wallet credit is applied before the hold.
                </Text>
              )}
              <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 14 }} />
              <Line l="Held now · charged on delivery" v={fmt.money(quote.total_cents + tipCents)} bold />
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  placeholder="Enter gift card or code" value={promoCode}
                  onChangeText={(v) => { setPromoCode(v); setPromoMsg(''); }}
                  style={{ flex: 1, borderWidth: 1.5, borderColor: t.gray3, borderRadius: 12, padding: 14, fontSize: 15 }}
                />
                <Button sm variant="ghost" disabled={!promoCode.trim()} onPress={() => setPromoMsg('No active promotions right now')}>Apply</Button>
              </View>
              {!!promoMsg && <Text style={{ color: t.gray, fontSize: 12, marginTop: 8 }}>{promoMsg}</Text>}
            </Card>

            <Card style={{ marginBottom: 14 }} onPress={() => setUseCredit((x) => !x)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: satoshi(700) }}>Use wallet credit ({fmt.money(summary?.balance_cents)})</Text>
                <Switch value={useCredit} onChange={setUseCredit} />
              </View>
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <Eyebrow style={{ marginBottom: 10 }}>Tip your driver?</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 200, 400, 1000].map((amt) => (
                  <Button key={amt} sm variant={tipCents === amt ? 'lime' : 'ghost'} onPress={() => setTipCents(amt)} style={{ flex: 1 }}>{amt === 0 ? 'No' : fmt.money(amt)}</Button>
                ))}
              </View>
            </Card>

            {!summary?.subscription && plans.filter((p) => p.price_cents > 0).map((p) => (
              <Card key={p.id} onPress={() => setUpsellPlan((x) => (x === p.id ? null : p.id))} style={{ marginBottom: 10, borderWidth: 2, borderColor: upsellPlan === p.id ? t.navy : 'transparent' }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 20, borderWidth: 2, borderColor: t.navy, alignItems: 'center', justifyContent: 'center' }}>
                    {upsellPlan === p.id && <View style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: t.navy }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: satoshi(700) }}>ChaseLaundry {p.name}</Text>
                      <Text style={{ fontFamily: satoshi(800) }}>{fmt.money(p.price_cents)}/mo</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>{p.perks[0]}</Text>
                  </View>
                </View>
              </Card>
            ))}

            <OrderSummaryCard
              addr={addresses.find((a) => a.id === addrId)} items={items} catalog={catalog} slot={slot} handover={handover}
              onEditSlot={() => setStep(1)} onEditItems={() => setStep(2)}
            />

            <Card style={{ marginBottom: 14, backgroundColor: t.accentPale }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ fontSize: 26 }}>🌱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: satoshi(900), color: t.navy, marginBottom: 2 }}>The sustainable choice</Text>
                  <Text style={{ fontSize: 12, color: t.gray }}>We route deliveries efficiently and use eco-conscious detergents where possible.</Text>
                </View>
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button variant="ghost" onPress={() => setStep(skipItemStep ? 1 : 2)} style={{ flex: 1 }}>Back</Button>
              <Button variant="lime" disabled={placing} onPress={placeWithUpsell} style={{ flex: 2 }}>
                {placing ? 'Placing…' : `Confirm · hold ${fmt.money(quote.total_cents + tipCents)}`}
              </Button>
            </View>

            <PaymentSheet
              open={!!payPlan} onClose={() => setPayPlan(null)} amountCents={payPlan?.price_cents || 0}
              recurring cta="Subscribe & pay" title={payPlan ? `Subscribe to ${payPlan.name}` : ''} description={payPlan ? `${payPlan.name} plan` : ''}
              confirmPayment={confirmPayment}
              onAuthorized={async () => { await activatePlan(payPlan.id); setPayPlan(null); await place(); }}
            />
          </View>
        )
      )}
    </Sheet>
  );
}

function OrderSummaryCard({ addr, items, catalog, slot, handover, onEditSlot, onEditItems }) {
  const t = useTheme();
  const maxEta = Math.max(0, ...items.map((i) => catalog.find((c) => c.id === i.catalog_id)?.eta_hours || 0));
  return (
    <Card style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: satoshi(900), fontSize: 15, marginBottom: 12 }}>Order details</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Collection</Eyebrow>
          <Text style={{ fontSize: 13, marginTop: 2 }}>{slot} · {HANDOVER[handover]?.label}</Text>
          {maxEta > 0 && <Text style={{ color: t.gray, fontSize: 12, marginTop: 4 }}>Estimated delivery: {etaLabel(maxEta)} after collection</Text>}
        </View>
        <Pressable onPress={onEditSlot}><Text style={{ fontSize: 16, color: t.navy }}>✎</Text></Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 6 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginVertical: 12 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 6 }}>Services</Eyebrow>
          {items.map((i) => {
            const c = catalog.find((x) => x.id === i.catalog_id);
            if (!c) return null;
            return (
              <View key={i.catalog_id} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                <Text style={{ fontSize: 13 }}>{c.name} {i.weight_kg ? `· ${i.weight_kg}kg` : i.qty > 1 ? `× ${i.qty}` : ''}</Text>
              </View>
            );
          })}
        </View>
        <Pressable onPress={onEditItems}><Text style={{ fontSize: 16, color: t.navy }}>✎</Text></Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: t.gray3, marginVertical: 6 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
        <Text style={{ fontSize: 13 }}>{addr ? `${addr.line1}, ${addr.postcode}` : '—'}</Text>
        <Pressable onPress={onEditSlot}><Text style={{ fontSize: 16, color: t.navy }}>✎</Text></Pressable>
      </View>
    </Card>
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
