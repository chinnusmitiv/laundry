import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, Animated, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

const ANIM_MS = 220;
const { width: SCREEN_W } = Dimensions.get('window');

// Full-screen panel that slides in from the right — the native equivalent of
// shared/index.jsx's <Sheet> phone-width drawer variant (native is always phone-width,
// so there's no separate "wide viewport → centered modal" branch to port).
export function Sheet({ open, onClose, title, children, scroll = true }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const x = useRef(new Animated.Value(SCREEN_W)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      x.setValue(SCREEN_W);
      Animated.parallel([
        Animated.timing(x, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(x, { toValue: SCREEN_W, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [open]);

  if (!mounted) return null;

  const Body = scroll ? ScrollView : View;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(22,32,64,.45)', opacity: backdrop }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.light, transform: [{ translateX: x }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 14, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: t.gray3 }}>
          <Pressable onPress={onClose} style={{ width: 30 }}><Text style={{ fontSize: 22, color: t.navy }}>‹</Text></Pressable>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', paddingHorizontal: 8 }}>{title}</Text>
          <Pressable onPress={onClose}><Text style={{ fontSize: 13, fontWeight: '700', color: t.navy }}>Cancel</Text></Pressable>
        </View>
        <Body style={{ flex: 1 }} contentContainerStyle={scroll ? { padding: 20, paddingBottom: insets.bottom + 30 } : undefined}>
          {children}
        </Body>
      </Animated.View>
    </Modal>
  );
}
