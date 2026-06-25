// ──────────────────────────────────────────────────────────────
// Mock external integrations. Everything here is simulated for the
// POC — no real API keys. Each call logs a realistic "side effect"
// so the demo can show that emails/charges/etc. would have fired.
// ──────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid';
import { db } from './db.js';

const log = (svc, msg) => console.log(`  ⟶ [${svc}] ${msg}`);

// --- Payments (Stripe-shaped) ---
export const payments = {
  createIntent({ amountCents, description }) {
    const id = `pi_${nanoid(16)}`;
    log('stripe', `PaymentIntent ${id} — S$${(amountCents / 100).toFixed(2)} (${description}) → requires_payment_method`);
    return { id, client_secret: `${id}_secret_${nanoid(12)}`, amount: amountCents, status: 'requires_payment_method' };
  },
  charge({ orderId, amountCents, customer }) {
    log('stripe', `charge S$${(amountCents / 100).toFixed(2)} for ${orderId} (${customer?.email}) → succeeded (test mode)`);
    return { id: `pi_${nanoid(16)}`, status: 'succeeded', amount: amountCents };
  },
  refund({ orderId, amountCents }) {
    log('stripe', `refund S$${(amountCents / 100).toFixed(2)} for ${orderId} → succeeded`);
    return { id: `re_${nanoid(16)}`, status: 'succeeded' };
  },
  createSubscription({ user, plan }) {
    log('stripe', `subscription ${plan.name} (S$${(plan.price_cents / 100).toFixed(2)}/mo) for ${user.email} → active`);
    return { id: `sub_${nanoid(14)}`, status: 'active' };
  },
};

// --- Email (transactional) ---
export const email = {
  send({ to, subject, body }) {
    log('email', `to ${to} — "${subject}"`);
    return { id: `em_${nanoid(12)}`, delivered: true };
  },
};

// --- Push notifications ---
export const push = {
  send({ to, title, body }) {
    log('push', `to ${to} — "${title}"`);
    return { id: `pn_${nanoid(12)}`, delivered: true };
  },
};

// --- Google review deep-link (driver shows QR; scanning opens Google review) ---
export const google = {
  reviewLink(orderCode) {
    // In production this is your Google Business "write a review" URL.
    const placeId = 'ChIJChaseLaundryPOC';
    return `https://search.google.com/local/writereview?placeid=${placeId}&ref=${orderCode}`;
  },
};

// --- Geo: simulate a driver moving toward a destination ---
// Returns the next lat/lng stepping a fraction toward the target.
export function stepToward({ lat, lng }, { lat: tLat, lng: tLng }, fraction = 0.18) {
  return {
    lat: lat + (tLat - lat) * fraction,
    lng: lng + (tLng - lng) * fraction,
  };
}

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// --- helper: write a notification row + fire its channel side-effect ---
export function notify({ io, userId, type, title, body, channel = 'inapp', orderId = null }) {
  const id = `ntf_${nanoid(10)}`;
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO notifications (id,user_id,type,title,body,channel,order_id,read,created_at) VALUES (?,?,?,?,?,?,?,0,?)')
    .run(id, userId, type, title, body, channel, orderId, created_at);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (user?.email) email.send({ to: user.email, subject: title, body });
  push.send({ to: user?.name || userId, title, body });

  const row = { id, user_id: userId, type, title, body, channel, order_id: orderId, read: 0, created_at };
  io?.to(`user:${userId}`).emit('notification', row);
  return row;
}
