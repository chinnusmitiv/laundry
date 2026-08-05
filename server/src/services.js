// ──────────────────────────────────────────────────────────────
// Mock external integrations. Most of this is simulated for the
// POC — no real API keys. Each call logs a realistic "side effect"
// so the demo can show that emails/charges/etc. would have fired.
// Login OTP emails are the one exception: those go out for real via
// Gmail SMTP, since a code that only appears in a server log isn't
// usable as an actual login flow.
// ──────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import { db } from './db.js';

const log = (svc, msg) => console.log(`  ⟶ [${svc}] ${msg}`);

// --- real SMTP transport (Gmail), used only for login OTP emails ---
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const mailer = gmailUser && gmailPass
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } })
  : null;

if (!mailer) {
  console.warn('⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not set — login OTP emails will fail to send. See server/.env.example.');
}

// send a real email — used only for login OTP codes and referral invites, not general notifications
export async function sendRealEmail({ to, subject, body, html }) {
  if (!mailer) throw new Error('Email is not configured on the server (missing GMAIL_USER / GMAIL_APP_PASSWORD).');
  await mailer.sendMail({ from: `ChaseLaundry <${gmailUser}>`, to, subject, text: body, ...(html ? { html } : {}) });
  log('email', `to ${to} — "${subject}" → sent (real)`);
}

// ── branded HTML email templates (login OTP + referral invite) ──
// Table-based layout with inline styles only, and an inline-SVG logo mark (no
// externally-hosted image) so the brand renders identically across clients
// without depending on image-blocking settings or a public asset URL.
const NAVY = '#1D2951', LIME = '#C7FF33', LIME_D = '#A8D400', GRAY = '#6B7280';

function logoMarkSvg(size, stroke) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" style="display:block">
    <path d="M 82.34 62.51 A 34 34 0 1 1 68.02 23.17" stroke="${stroke}" stroke-width="11" stroke-linecap="round" fill="none" />
    <circle cx="82.78" cy="32.00" r="6.0" fill="${LIME}" />
  </svg>`;
}

function emailShell(innerHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F5F8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F8;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:${NAVY};padding:28px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:10px;">${logoMarkSvg(30, LIME)}</td>
              <td style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">Chase<span style="color:${LIME};">Laundry</span></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:36px 32px;">${innerHtml}</td></tr>
          <tr><td style="padding:20px 32px 28px;border-top:1px solid #EEF0F4;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${GRAY};">More Life. Less Laundry.</p>
            <p style="margin:0;font-size:12px;color:${GRAY};">ChaseLaundry · 1 Kim Seng Promenade, Singapore 237994 · chaselaundry.com</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

export function otpEmail(code) {
  const digits = code.split('').map((d) =>
    `<td style="width:38px;height:46px;background:#F4F5F8;border-radius:8px;text-align:center;vertical-align:middle;font-size:22px;font-weight:900;color:${NAVY};font-family:monospace;">${d}</td>`
  ).join(`<td style="width:8px;"></td>`);
  const html = emailShell(`
    <p style="margin:0 0 6px;font-size:20px;font-weight:900;color:${NAVY};">Your login code</p>
    <p style="margin:0 0 24px;font-size:14px;color:${GRAY};line-height:1.5;">Enter this code to sign in to ChaseLaundry. It expires in 5 minutes.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>${digits}</tr></table>
    <p style="margin:0;font-size:12px;color:${GRAY};line-height:1.5;">Didn't request this? You can safely ignore this email — your account is still secure.</p>
  `);
  return { subject: 'Your ChaseLaundry login code', body: `Your one-time login code is ${code}. It expires in 5 minutes.`, html };
}

export function referralEmail({ inviterName, code, rewardLabel = 'S$5.00' }) {
  const name = inviterName || 'A friend';
  const html = emailShell(`
    <p style="margin:0 0 6px;font-size:20px;font-weight:900;color:${NAVY};">${name} thinks you'll love ChaseLaundry</p>
    <p style="margin:0 0 24px;font-size:14px;color:${GRAY};line-height:1.5;">Free pickup &amp; delivery laundry and dry cleaning, right to your door. Sign up with the code below and you'll both get ${rewardLabel} credit once you place your first order.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F8;border-radius:12px;margin-bottom:20px;"><tr><td style="padding:18px 20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${GRAY};">Referral code</p>
      <p style="margin:0;font-size:26px;font-weight:900;letter-spacing:2px;color:${NAVY};font-family:monospace;">${code}</p>
    </td></tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${LIME_D};border-radius:10px;">
      <span style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:800;color:${NAVY};">Get ${rewardLabel} credit → chaselaundry.com</span>
    </td></tr></table>
  `);
  return {
    subject: `${name} invited you to ChaseLaundry — get ${rewardLabel} credit`,
    body: `${name} thinks you'll love ChaseLaundry and wants to give you ${rewardLabel} credit on your first order.\n\nUse referral code ${code} when you sign up — you'll both get ${rewardLabel} once you place your first order.`,
    html,
  };
}

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
  // Hold funds on the card without taking them (Stripe: capture_method='manual').
  authorize({ orderId, amountCents, customer }) {
    const id = `pi_${nanoid(16)}`;
    log('stripe', `authorize (hold) S$${(amountCents / 100).toFixed(2)} for ${orderId} (${customer?.email}) → requires_capture (test mode)`);
    return { id, status: 'requires_capture', amount: amountCents };
  },
  // Take the previously-held funds once the order is fulfilled.
  capture({ authId, orderId, amountCents }) {
    log('stripe', `capture S$${(amountCents / 100).toFixed(2)} on ${authId} for ${orderId} → succeeded (test mode)`);
    return { id: authId, status: 'succeeded', amount: amountCents };
  },
  // Release a hold without charging (order cancelled).
  voidAuth({ authId, orderId }) {
    log('stripe', `void/release hold ${authId} for ${orderId} → canceled (test mode)`);
    return { id: authId, status: 'canceled' };
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

// --- Bank payouts (factory cash withdrawals) — Stripe-Connect-shaped, mocked ---
export const bank = {
  payout({ facility, amountCents, account }) {
    const id = `po_${nanoid(16)}`;
    log('bank', `payout S$${(amountCents / 100).toFixed(2)} to ${facility?.name || 'facility'} (${account || 'bank account'}) → paid (test mode)`);
    return { id, status: 'paid', amount: amountCents };
  },
};

// --- Email (transactional) — mocked, like the rest of notify()'s side-effects ---
export const email = {
  send({ to, subject, body }) {
    log('email', `to ${to} — "${subject}"`);
    return { id: `em_${nanoid(12)}`, delivered: true };
  },
};

// --- Push notifications — real Expo push API (no server-side dependency needed,
// Node's built-in fetch talks to Expo's push service directly) ---
export const push = {
  async send({ to, title, body, data }) {
    if (!to) return { delivered: false };
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify([{ to, title, body, data, sound: 'default' }]),
      });
      const json = await res.json();
      log('push', `to ${to} — "${title}" → ${JSON.stringify(json.data || json)}`);
      return { delivered: true, ticket: json };
    } catch (e) {
      log('push', `failed to ${to}: ${e.message}`);
      return { delivered: false };
    }
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
  if (user?.push_token) push.send({ to: user.push_token, title, body, data: { orderId } });

  const row = { id, user_id: userId, type, title, body, channel, order_id: orderId, read: 0, created_at };
  io?.to(`user:${userId}`).emit('notification', row);
  return row;
}
