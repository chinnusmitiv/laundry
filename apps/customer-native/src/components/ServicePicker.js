import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Card, Chip, Stepper, Button, useTheme, satoshi, CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_DESC, CATEGORY_CHIPS, CATEGORY_INFO, categoryTint, etaLabel } from '@chaselaundry/shared-native';
import Loading from './Loading';

// Reusable Laundryheap-style service picker: service tabs + info header + Wash & Fold
// bundle flow / per-item grouped pricelist. Shared by the Prices tab and the booking
// flow's "what needs cleaning" step so both feel identical — ported from
// apps/customer/src/App.jsx's <ServicePicker>.
export default function ServicePicker({ catalog, cart, setCart, initialCat, onAskTeam }) {
  const t = useTheme();
  const [cat, setCat] = useState(initialCat || 'wash_fold');
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => { setInfoOpen(false); }, [cat]);

  const categories = useMemo(() => {
    const present = new Set(catalog.map((c) => c.category));
    return CATEGORY_ORDER.filter((k) => present.has(k));
  }, [catalog]);

  const setItem = (id, patch) => setCart((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const items = catalog.filter((c) => c.category === cat);
  const headIcon = items[0]?.icon || '🧺';

  if (!catalog.length) return <Loading />;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
        {categories.map((k) => (
          <Pressable key={k} onPress={() => setCat(k)} style={{
            paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999,
            backgroundColor: cat === k ? t.navy : '#fff', ...( cat === k ? {} : t.shadowSm ),
          }}>
            <Text style={{ fontFamily: satoshi(800), fontSize: 13, color: cat === k ? '#fff' : t.gray }}>{CATEGORY_LABEL[k]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
            <View style={{ width: 44, height: 44, borderRadius: 44, backgroundColor: categoryTint(t, cat), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>{headIcon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: satoshi(900), fontSize: 17 }}>{CATEGORY_LABEL[cat]}</Text>
              <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>{CATEGORY_DESC[cat]}</Text>
            </View>
          </View>
          <Pressable onPress={() => setInfoOpen((x) => !x)}><Text style={{ fontSize: 12, fontFamily: satoshi(800), color: t.navy }}>{infoOpen ? 'Less' : 'Learn more'}</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {(CATEGORY_CHIPS[cat] || []).map((c) => <Chip key={c} variant="gray">{c}</Chip>)}
        </View>
        {infoOpen && <Text style={{ fontSize: 12, color: t.gray, marginTop: 12, lineHeight: 18 }}>{CATEGORY_INFO[cat]}</Text>}
      </Card>

      {cat === 'wash_fold'
        ? <WashFoldPricelist items={items} cart={cart} setItem={setItem} />
        : <ItemPricelist items={items} cart={cart} setItem={setItem} onAskTeam={onAskTeam} />}
    </View>
  );
}

function WashFoldPricelist({ items, cart, setItem }) {
  const t = useTheme();
  const base = items.find((c) => /fold/i.test(c.name)) || items[0];
  const perKg = base.price_cents;
  const BUNDLES = [
    { key: 'mixed', name: 'Mixed Wash & Fold', desc: 'All colours washed together.', kg: 6 },
    { key: 'separate', name: 'Separate Wash & Fold', desc: 'Lights and darks washed separately.', kg: 12 },
  ];
  const cur = cart[base.id]?.weight || 0;
  const activeKg = cur >= 12 ? 12 : cur >= 6 ? 6 : 0;
  const extra = Math.max(0, cur - activeKg);

  const pick = (kg) => setItem(base.id, { weight: kg });
  const setExtra = (n) => activeKg && setItem(base.id, { weight: activeKg + Math.max(0, n) });

  return (
    <View>
      {BUNDLES.map((b) => {
        const on = activeKg === b.kg;
        return (
          <Card key={b.key} onPress={() => pick(b.kg)} style={{ marginBottom: 12, borderWidth: 2, borderColor: on ? t.navy : 'transparent', backgroundColor: on ? t.accentPale : '#fff' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: satoshi(800), fontSize: 15 }}>{b.name}</Text>
                <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>{b.desc}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: satoshi(900), fontSize: 15 }}>{fmtMoney(perKg * b.kg)}</Text>
                <Text style={{ fontSize: 11, color: t.gray }}>/ {b.kg}kg</Text>
              </View>
            </View>
          </Card>
        );
      })}

      <Card style={{ marginBottom: 12, backgroundColor: t.accentPale }}>
        <Text style={{ fontFamily: satoshi(800), fontSize: 14, marginBottom: 4 }}>What if I have more?</Text>
        <Text style={{ fontSize: 12, color: t.gray, marginBottom: activeKg ? 12 : 0 }}>
          You can send as much as you need. Each additional kg costs {fmtMoney(perKg)}.
        </Text>
        {activeKg ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: satoshi(700), fontSize: 13 }}>Additional weight</Text>
            <Stepper value={extra} step={1} unit="kg" onChange={setExtra} />
          </View>
        ) : null}
      </Card>

      <Card style={{ marginBottom: 12, backgroundColor: t.light }}>
        <Text style={{ fontFamily: satoshi(800), fontSize: 14, marginBottom: 8 }}>See what 6kg looks like</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {['12 shirts', '3 trousers', '7 underwear', '7 pairs of socks'].map((tx) => <Chip key={tx} variant="gray">{tx}</Chip>)}
        </View>
      </Card>
    </View>
  );
}

function ItemPricelist({ items, cart, setItem, onAskTeam }) {
  const t = useTheme();
  const groups = useMemo(() => {
    const ORDER = ['Shirts', 'Tops', 'Bottoms', 'Suits', 'Dresses', 'Traditional', 'Outerwear', 'Accessories', 'Home', 'Duvets', 'Bedding', 'Curtains', 'Footwear', 'Bags'];
    const present = [...new Set(items.map((c) => c.grp || 'All'))];
    return present.sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [items]);
  const [grp, setGrp] = useState(groups[0]);
  useEffect(() => { if (!groups.includes(grp)) setGrp(groups[0]); }, [groups, grp]);

  const shown = items.filter((c) => (c.grp || 'All') === grp);
  const addedInGroup = (g) => items.filter((c) => (c.grp || 'All') === g && (cart[c.id]?.qty || 0) > 0).length;

  return (
    <View>
      {groups.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, borderBottomWidth: 1, borderBottomColor: t.gray3 }} contentContainerStyle={{ gap: 18 }}>
          {groups.map((g) => {
            const on = g === grp, n = addedInGroup(g);
            return (
              <Pressable key={g} onPress={() => setGrp(g)} style={{ paddingVertical: 6, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: on ? t.navy : 'transparent' }}>
                <Text style={{ fontFamily: satoshi(on ? 800 : 600), fontSize: 14, color: on ? t.navy : t.gray2 }}>{g}{n > 0 ? ` · ${n}` : ''}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Text style={{ fontFamily: satoshi(900), fontSize: 15, marginBottom: 10 }}>{grp}</Text>
      <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
        {shown.map((c, i) => {
          const v = cart[c.id] || {};
          const qty = v.qty || 0;
          return (
            <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: i < shown.length - 1 ? 1 : 0, borderBottomColor: t.gray3, backgroundColor: qty > 0 ? t.accentPale : '#fff' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{c.name}</Text>
                <Text style={{ fontSize: 11, color: t.gray, marginTop: 2 }}>{etaLabel(c.eta_hours)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontFamily: satoshi(800), fontSize: 14 }}>{fmtMoney(c.price_cents)}</Text>
                {qty > 0
                  ? <Stepper value={qty} step={1} onChange={(q) => setItem(c.id, { qty: q })} />
                  : <Button sm variant="ghost" onPress={() => setItem(c.id, { qty: 1 })}>+ Add</Button>}
              </View>
            </View>
          );
        })}
      </Card>

      {onAskTeam && (
        <Card style={{ marginBottom: 12 }} onPress={onAskTeam}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontFamily: satoshi(800), fontSize: 14 }}>Can't find your item?</Text>
              <Text style={{ fontSize: 12, color: t.navy, fontFamily: satoshi(700), marginTop: 2 }}>Ask our team</Text>
            </View>
            <Text style={{ fontSize: 20 }}>→</Text>
          </View>
        </Card>
      )}
    </View>
  );
}

function fmtMoney(cents) { return `S$${((cents || 0) / 100).toFixed(2)}`; }
