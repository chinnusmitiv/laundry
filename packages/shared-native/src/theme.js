// Design tokens ported from shared/brand/theme.css (+ apps/customer/src/laundryheap.css
// override). Two theme variants exist because the two web apps render different skins:
// driver-web uses the raw shared tokens (navy/lime); customer-web overrides them to the
// "Laundryheap" navy-blue/blue skin. Each native app picks the theme matching its web twin.
const common = {
  white: '#FFFFFF',
  text: '#1F2937',
  gray: '#6B7280',
  gray2: '#9CA3AF',
  gray3: '#E5E7EB',
  ok: '#16A34A',
  warn: '#F59E0B',
  danger: '#EF4444',
  radius: 18,
  radiusSm: 11,
  font: 'Satoshi',
  shadowSm: {
    shadowColor: '#1D2951', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  shadow: {
    shadowColor: '#1D2951', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 12,
  },
};

// driver-native — matches driver-web's unmodified shared theme (navy + lime-green)
export const navyLimeTheme = {
  ...common,
  navy: '#1D2951', navy2: '#162040', navy3: '#253470',
  accent: '#C7FF33', accentD: '#A8D400', accentPale: '#F0FFD0',
  bg: '#E8ECF6', light: '#F5F7FA',
  onAccentText: '#1D2951', // .cl-btn-lime → navy text (no laundryheap override on driver)
  chipNavyText: '#C7FF33', // .cl-chip-navy → lime text
  logoAccent: '#C7FF33', logoAccentD: '#A8D400', // wordmark accent — same as accent here
};

// customer-native — matches customer-web's laundryheap.css override (navy-blue + blue)
export const navyBlueTheme = {
  ...common,
  navy: '#0E2A63', navy2: '#0A2050', navy3: '#16357E',
  accent: '#2563EB', accentD: '#1D4ED8', accentPale: '#EAF1FE',
  bg: '#FFFFFF', light: '#F4F7FE',
  onAccentText: '#FFFFFF', // .cl-btn-lime { color:#fff !important }
  chipNavyText: '#FFFFFF', // .cl-chip-navy { color:#fff !important }
  logoAccent: '#2563EB', logoAccentD: '#1D4ED8', // wordmark accent — same as accent here
};

// customer-native's actual in-use theme, per explicit product direction: the wordmark
// stays lime (logoAccent/logoAccentD), but every interactive accent — primary buttons,
// checkmarks, the notification badge, navy-chip text — is blue, matching customer-web's
// laundryheap.css skin exactly (.cl-btn-lime, .cl-chip-navy overrides).
export const customerTheme = {
  ...navyLimeTheme,
  accent: '#2563EB', accentD: '#1D4ED8', accentPale: '#EAF1FE',
  onAccentText: '#FFFFFF',
  chipNavyText: '#FFFFFF',
  logoAccent: '#C7FF33', logoAccentD: '#A8D400',
};

// Satoshi ships as 4 static weight files loaded under distinct family names (see
// fonts.js) — RN can't fake intermediate weights on a custom font like CSS font-weight
// does, so every numeric weight buckets down to the nearest loaded family.
export function satoshi(weight = 400) {
  const w = typeof weight === 'string' ? parseInt(weight, 10) : weight;
  if (w >= 800) return 'Satoshi-Black';
  if (w >= 700) return 'Satoshi-Bold';
  if (w >= 500) return 'Satoshi-Medium';
  return 'Satoshi-Regular';
}

export const STATUS_COLOR = {
  placed: '#9CA3AF', assigned: '#6366F1', driver_en_route: '#3B82F6', picked_up: '#3B82F6',
  at_facility: '#8B5CF6', confirmed: '#0EA5E9', processing: '#8B5CF6', ready: '#10B981',
  out_for_delivery: '#F59E0B', delivered: '#16A34A', completed: '#16A34A', cancelled: '#EF4444',
};
export const statusColor = (status) => STATUS_COLOR[status] || '#9CA3AF';
