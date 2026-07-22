import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from './ThemeContext';
import { satoshi } from './theme';

// the ChaseLaundry "C arc + dot" wordmark — ported 1:1 from shared/index.jsx's <Mark>
export function Mark({ size = 40, stroke = '#C7FF33', dot = '#C7FF33' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M 82.34 62.51 A 34 34 0 1 1 68.02 23.17" stroke={stroke} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Circle cx={82.78} cy={32.0} r={6.0} fill={dot} />
    </Svg>
  );
}

export function Logo({ size = 28, mode = 'dark', tagline = false }) {
  const t = useTheme();
  const isDark = mode === 'dark';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Mark size={size * 1.3} stroke={isDark ? t.logoAccent : t.navy} dot={t.logoAccent} />
      <View>
        <Text style={{ fontSize: size, fontFamily: satoshi(900), letterSpacing: -1, lineHeight: size, color: isDark ? '#fff' : t.navy }}>
          Chase<Text style={{ color: isDark ? t.logoAccent : t.logoAccentD }}>Laundry</Text>
        </Text>
        {tagline && (
          <Text style={{ fontSize: 9, fontFamily: satoshi(700), letterSpacing: 1.5, textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,.4)' : 'rgba(29,41,81,.4)', marginTop: 4 }}>
            More Life. Less Laundry.
          </Text>
        )}
      </View>
    </View>
  );
}
