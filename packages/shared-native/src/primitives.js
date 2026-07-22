import React, { useState, useRef } from 'react';
import { View, Text, Pressable, TextInput, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';
import { statusColor, satoshi } from './theme';

// ── Button — variants: navy (default), lime (accent fill), ghost. `sm` = auto-width pill.
export function Button({ children, variant = 'navy', sm, disabled, onPress, style, textStyle }) {
  const t = useTheme();
  const bg = variant === 'lime' ? t.accent : variant === 'ghost' ? `${t.navy}0F` : t.navy;
  const color = variant === 'lime' ? t.onAccentText : variant === 'ghost' ? t.navy : '#fff';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg, borderRadius: sm ? t.radiusSm : 14,
          paddingVertical: sm ? 10 : 15, paddingHorizontal: sm ? 16 : 22,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: sm ? 'flex-start' : 'stretch',
        },
        style,
      ]}
    >
      {React.isValidElement(children)
        ? children
        : <Text style={[{ color, fontFamily: satoshi(800), fontSize: sm ? 13 : 15 }, textStyle]}>{children}</Text>}
    </Pressable>
  );
}

// ── Card — white surface, brand radius + soft shadow
export function Card({ children, style, onPress }) {
  const t = useTheme();
  const base = { backgroundColor: '#fff', borderRadius: t.radius, padding: 18, ...t.shadowSm };
  if (onPress) {
    return <Pressable onPress={onPress} style={[base, style]}>{children}</Pressable>;
  }
  return <View style={[base, style]}>{children}</View>;
}

// ── Chip — fully-rounded label pill. variants: default (pale accent), navy, gray
export function Chip({ children, variant, style }) {
  const t = useTheme();
  const bg = variant === 'navy' ? t.navy : variant === 'gray' ? t.gray3 : t.accentPale;
  const color = variant === 'navy' ? t.chipNavyText : variant === 'gray' ? t.gray : t.navy;
  return (
    <View style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: bg }, style]}>
      <Text style={{ fontSize: 11, fontFamily: satoshi(800), letterSpacing: 0.3, color }}>{children}</Text>
    </View>
  );
}

export function Eyebrow({ children, style }) {
  const t = useTheme();
  return <Text style={[{ fontSize: 10, fontFamily: satoshi(800), letterSpacing: 2, textTransform: 'uppercase', color: t.gray2 }, style]}>{children}</Text>;
}

// ── Field — labeled text input matching .cl-field (border, radius, focus ring)
export function Field({ label, style, inputStyle, ...props }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label && <Text style={{ fontSize: 12, fontFamily: satoshi(700), color: t.gray, marginBottom: 6 }}>{label}</Text>}
      <TextInput
        placeholderTextColor={t.gray2}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[{ width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: focused ? t.navy : t.gray3, backgroundColor: '#fff', fontSize: 15, fontFamily: satoshi(400), color: t.text }, inputStyle]}
        {...props}
      />
    </View>
  );
}

// ── Avatar — initials circle. Text colour intentionally hardcoded lime (matches
// shared/index.jsx's Avatar, which never gets themed by laundryheap.css either).
export function Avatar({ name, color, size = 38 }) {
  const t = useTheme();
  const initials = name ? name.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color || t.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#C7FF33', fontFamily: satoshi(800), fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// ── StatusPill — dot + label, coloured per order/job status
export function StatusPill({ status, label }) {
  const c = statusColor(status);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: `${c}1A`, alignSelf: 'flex-start' }}>
      <View style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: c }} />
      <Text style={{ fontSize: 11, fontFamily: satoshi(800), color: c }}>{label || status}</Text>
    </View>
  );
}

// ── TopBar — solid navy header bar (logo/title left, actions right)
export function TopBar({ left, right, title, subtitle }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: t.navy, paddingTop: insets.top + 14, paddingBottom: 16, paddingHorizontal: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          {left}
          {title && <Text style={{ fontSize: 20, fontFamily: satoshi(900), letterSpacing: -0.5, color: '#fff' }}>{title}</Text>}
          {subtitle && <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    </View>
  );
}

// ── BottomNav — 5-tab bar with an elevated circular FAB tab (e.g. "Book now")
export function BottomNav({ tabs, active, onChange }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: t.gray3, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 14), paddingHorizontal: 4 }}>
      {tabs.map((tab) => tab.fab ? (
        <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          <View style={{ width: 52, height: 52, borderRadius: 52, backgroundColor: t.navy, alignItems: 'center', justifyContent: 'center', marginTop: -30, borderWidth: 4, borderColor: '#fff', ...t.shadowSm }}>
            <Text style={{ fontSize: 22 }}>{tab.icon}</Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: satoshi(700), color: t.navy }}>{tab.label}</Text>
        </Pressable>
      ) : (
        <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
          <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
          <Text style={{ fontSize: 10, fontFamily: satoshi(700), color: active === tab.key ? t.navy : t.gray2 }}>{tab.label}</Text>
          {tab.badge ? (
            <View style={{ position: 'absolute', top: -2, right: '30%', backgroundColor: t.danger, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontFamily: satoshi(800) }}>{tab.badge}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

// ── Empty — centered icon/title/subtitle placeholder
export function Empty({ icon = '📭', title, sub }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 42, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ fontFamily: satoshi(800), color: t.gray }}>{title}</Text>
      {sub && <Text style={{ fontSize: 13, marginTop: 4, color: t.gray2, textAlign: 'center' }}>{sub}</Text>}
    </View>
  );
}

// ── GarmentJourney — per-garment stage timeline strip (checked-in → returned)
const GARMENT_STAGES = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];
const GARMENT_STAGE_LABEL = { checked_in: 'Checked in', washing: 'Washing', drying: 'Drying', ironing: 'Ironing', qc: 'Quality check', packed: 'Packed', returned: 'Returned' };
const GARMENT_STAGE_ICON = { checked_in: '🏷️', washing: '🫧', drying: '🌬️', ironing: '🔥', qc: '🔍', packed: '📦', returned: '✅' };
export const GARMENT_LABEL = GARMENT_STAGE_LABEL;

// ── Switch — small on/off pill toggle (repeat-order, use-wallet-credit, etc.)
export function Switch({ value, onChange }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ width: 44, height: 26, borderRadius: 999, backgroundColor: value ? t.accent : t.gray3, justifyContent: 'center' }}>
      <View style={{ width: 20, height: 20, borderRadius: 20, backgroundColor: '#fff', marginLeft: value ? 21 : 3 }} />
    </Pressable>
  );
}

// ── Stepper — qty/weight +/- control (catalog items, wash & fold extra kg)
export function Stepper({ value, step = 1, unit, onChange }) {
  const t = useTheme();
  const circle = { width: 32, height: 32, borderRadius: 32, alignItems: 'center', justifyContent: 'center' };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={() => onChange(Math.max(0, +(value - step).toFixed(1)))} style={[circle, { backgroundColor: t.gray3 }]}>
        <Text style={{ fontSize: 18, fontFamily: satoshi(800), color: t.navy }}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 40, textAlign: 'center', fontFamily: satoshi(800) }}>{value || 0}{unit && value ? unit : ''}</Text>
      <Pressable onPress={() => onChange(+(value + step).toFixed(1))} style={[circle, { backgroundColor: t.navy }]}>
        <Text style={{ fontSize: 18, fontFamily: satoshi(800), color: '#fff' }}>+</Text>
      </Pressable>
    </View>
  );
}

// ── PlacesAutocomplete — Singapore address search. `search(query)` is supplied by the
// app (each app owns its own API client) and should resolve to an array of place results.
export function PlacesAutocomplete({ search, onSelect, placeholder = 'Search address or postcode…', autoFocus }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const onChangeText = (val) => {
    setQ(val);
    clearTimeout(timer.current);
    if (val.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try { setResults(await search(val)); } finally { setLoading(false); }
    }, 250);
  };

  const choose = (p) => { setQ(p.description || p.name); setResults([]); onSelect?.(p); };

  return (
    <View>
      <TextInput
        autoFocus={autoFocus}
        value={q}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.gray2}
        style={{ width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: t.gray3, backgroundColor: '#fff', fontSize: 15, color: t.text }}
      />
      {q.trim().length >= 2 && (loading || results.length > 0) && (
        <View style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: t.gray3, overflow: 'hidden' }}>
          {loading && results.length === 0 && <Text style={{ padding: 14, fontSize: 13, color: t.gray }}>Searching…</Text>}
          {results.map((p) => (
            <Pressable key={(p.postcode || '') + p.name} onPress={() => choose(p)} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: t.gray3 }}>
              <Text style={{ fontFamily: satoshi(700), fontSize: 14 }}>{p.name}</Text>
              <Text style={{ fontSize: 12, color: t.gray, marginTop: 2 }}>{p.line1} · {p.area} {p.postcode}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function GarmentJourney({ garment, compact, fmtTime }) {
  const t = useTheme();
  const idx = GARMENT_STAGES.indexOf(garment.status);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: compact ? 0 : 8 }}>
        {GARMENT_STAGES.map((s, i) => {
          const done = i <= idx;
          const cur = i === idx;
          return (
            <React.Fragment key={s}>
              <View style={{
                width: 30, height: 30, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
                backgroundColor: done ? t.accent : t.gray3, opacity: done ? 1 : 0.6,
                borderWidth: cur ? 3 : 0, borderColor: `${t.accent}59`,
              }}>
                <Text style={{ fontSize: 13 }}>{GARMENT_STAGE_ICON[s]}</Text>
              </View>
              {i < GARMENT_STAGES.length - 1 && <View style={{ flex: 1, minWidth: 6, height: 2, backgroundColor: i < idx ? t.accentD : t.gray3 }} />}
            </React.Fragment>
          );
        })}
      </View>
      {!compact && (
        <View style={{ marginTop: 6 }}>
          {(garment.events || []).slice().reverse().map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={{ fontSize: 12, fontFamily: satoshi(600) }}>{GARMENT_STAGE_ICON[e.status]} {GARMENT_STAGE_LABEL[e.status] || e.status}{e.actor === 'scan' ? ' · scanned' : ''}</Text>
              <Text style={{ fontSize: 12, color: t.gray }}>{fmtTime ? fmtTime(e.ts) : ''}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
