// Pure data/logic ported 1:1 from shared/api.js — no JSX, safe to share across apps.

export const CATEGORY_CHIPS = {
  wash_fold: ['WASH', 'TUMBLE-DRY', 'FOLDED', 'IN A BAG'],
  dry_clean: ['DRY CLEANING', 'IRONING', 'ON HANGERS'],
  bedding: ['CUSTOM CLEANING'],
  ironing: ['IRONING', 'ON HANGERS'],
  specialty: ['CUSTOM CLEANING'],
};
export const CATEGORY_DESC = {
  wash_fold: 'For everyday laundry, bedsheets and towels.',
  dry_clean: 'For everyday laundry that requires ironing after washing, or for dry cleaning.',
  bedding: 'For larger items that require extra care.',
  ironing: 'For items that are already clean.',
  specialty: 'Specialist care for delicate or bulky items.',
};
export const CATEGORY_LABEL = {
  wash_fold: 'Wash & Fold',
  dry_clean: 'Dry Cleaning',
  bedding: 'Duvets & Bulky Items',
  ironing: 'Ironing Only',
  specialty: 'Specialty Care',
};
export const CATEGORY_ORDER = ['wash_fold', 'dry_clean', 'ironing', 'bedding', 'specialty'];
export const CATEGORY_INFO = {
  wash_fold: 'Washed at 30–40°C, tumble-dried, neatly folded and bagged. Ideal for everyday clothes, bedsheets and towels.',
  dry_clean: 'Professionally dry-cleaned or wash-and-pressed, then returned on hangers — best for shirts, suits and dresses.',
  bedding: 'Bulky items like duvets and comforters get extra-care cleaning suited to their size and fabric.',
  ironing: 'Already-clean items pressed and returned on hangers — no washing included.',
  specialty: 'Deep-clean treatment for delicate or heavily-soiled items like trainers and bags.',
};
// theme-relative tints (web's CATEGORY_TINT uses literal rgba(navy) values —
// computed here from the active theme so it still looks right under either skin)
export function categoryTint(t, cat) {
  switch (cat) {
    case 'wash_fold': return t.accentPale;
    case 'dry_clean': return `${t.navy}14`;
    case 'ironing': return `${t.navy}24`;
    case 'bedding': return '#EAF7CF';
    case 'specialty': return `${t.navy}0D`;
    default: return t.accentPale;
  }
}
export function etaLabel(hours) {
  return hours >= 24 ? `${Math.round(hours / 24)} day service` : `${hours}h turnaround`;
}

export const STATUS_FLOW = ['placed', 'assigned', 'driver_en_route', 'picked_up', 'at_facility', 'processing', 'ready', 'out_for_delivery', 'delivered', 'completed'];
export const STATUS_LABEL = {
  placed: 'Order placed', assigned: 'Driver assigned', driver_en_route: 'Driver on the way',
  picked_up: 'Picked up', at_facility: 'At facility', processing: 'Cleaning in progress',
  ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
  completed: 'Completed', cancelled: 'Cancelled',
};

export const TICKET_CATEGORIES = [
  { key: 'order', label: 'Order issue', icon: '📦' },
  { key: 'billing', label: 'Billing & payments', icon: '💳' },
  { key: 'delivery', label: 'Pickup / delivery', icon: '🚚' },
  { key: 'account', label: 'Account', icon: '👤' },
  { key: 'other', label: 'Something else', icon: '💬' },
];

export const ADDRESS_TYPES = {
  home: { label: 'Home', icon: '🏠' },
  work: { label: 'Work', icon: '🏢' },
  other: { label: 'Other', icon: '📍' },
};

export const HANDOVER = {
  hand_to_me: { label: 'Hand to me', icon: '🙋', sub: "I'll pass the laundry to the driver" },
  leave_at_door: { label: 'Leave at my door', icon: '🚪', sub: 'Driver collects it from your door' },
  someone_else: { label: 'Someone else will hand over', icon: '🧑‍🤝‍🧑', sub: 'A friend, family member or concierge' },
};

export const GARMENT_FLOW = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];

export const REPEAT_CADENCE = {
  weekly: { label: 'Every week', days: 7 },
  biweekly: { label: 'Every 2 weeks', days: 14 },
  monthly: { label: 'Every month', days: 30 },
};
export function nextRepeatDue(order) {
  if (!order?.repeat_requested || !order?.repeat_cadence) return null;
  const days = REPEAT_CADENCE[order.repeat_cadence]?.days || 7;
  return new Date(new Date(order.created_at).getTime() + days * 864e5);
}

export const PICKUP_SLOTS = ['Today · 18:00–20:00', 'Tomorrow · 08:00–10:00', 'Tomorrow · 18:00–20:00'];

export const TOPUP_TIERS = [[2000, 5], [5000, 12], [10000, 18], [20000, 20]];
export function topupBonus(amount) {
  let pct = 0;
  for (const [min, p] of TOPUP_TIERS) if (amount >= min) pct = p;
  return { bonus: Math.floor((amount * pct) / 100), pct };
}

export function distKm(a, b) {
  if (!a?.lat || !b?.lat) return null;
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export const etaMins = (km) => (km == null ? null : Math.max(1, Math.round(km * 3)));
