import { nanoid } from 'nanoid';
import { randomInt } from 'node:crypto';
import { db } from './db.js';

const now = () => new Date().toISOString();
const id = (p) => `${p}_${nanoid(8)}`;
const WELCOME_CREDIT_CENTS = 1000; // S$10 welcome credit on first sign-up
const OTP_TTL_MS = 5 * 60 * 1000;  // codes valid for 5 minutes
const MAX_ATTEMPTS = 5;

// in-memory one-time-password store: key -> { code, expiresAt, attempts }
// (fine for a single-process demo; cleared on restart)
const otpStore = new Map();

const initials = (name) =>
  (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const publicUser = (u) => {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
};

// classify a raw identifier as an email or a phone number
function classify(raw) {
  const s = String(raw || '').trim();
  if (!s) return { valid: false };
  if (s.includes('@')) {
    const email = s.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { valid: false, error: 'Please enter a valid email.' };
    return { valid: true, channel: 'email', email };
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8) return { valid: false, error: 'Please enter a valid phone number.' };
  return { valid: true, channel: 'phone', digits };
}

const keyOf = (c) => (c.channel === 'email' ? `email:${c.email}` : `phone:${c.digits}`);

// find an existing customer for this identifier
function findUser(c) {
  if (c.channel === 'email') {
    return db.prepare(`SELECT * FROM users WHERE role = 'customer' AND LOWER(email) = ?`).get(c.email);
  }
  const rows = db.prepare(`SELECT * FROM users WHERE role = 'customer' AND phone IS NOT NULL`).all();
  return rows.find((u) => {
    const d = String(u.phone).replace(/\D/g, '');
    return d === c.digits || d.endsWith(c.digits) || c.digits.endsWith(d);
  });
}

// pretty-print a phone number for display (assumes 8-digit SG local numbers)
function formatPhone(digits) {
  let d = digits;
  if (d.length === 8) d = `65${d}`; // bare SG mobile → add country code
  if (d.startsWith('65') && d.length === 10) return `+65 ${d.slice(2, 6)} ${d.slice(6)}`;
  return `+${d}`;
}

function mask(c) {
  if (c.channel === 'email') {
    const [user, domain] = c.email.split('@');
    const head = user.length <= 2 ? user[0] : user.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
  }
  return `•••• ${c.digits.slice(-4)}`;
}

export function registerAuthRoutes(app, io) {
  // ---- step 1: request a one-time code ----
  app.post('/api/auth/request-otp', (req, res) => {
    const c = classify(req.body.identifier);
    if (!c.valid) return res.status(400).json({ error: c.error || 'Enter your email or phone number.' });

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    otpStore.set(keyOf(c), { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });

    // no SMS/email provider in this demo — log it and return it so it can be shown on screen
    console.log(`🔑 OTP for ${keyOf(c)} → ${code}`);
    res.json({
      channel: c.channel,
      sent_to: mask(c),
      is_new: !findUser(c),
      dev_code: code, // DEMO ONLY: a real deployment would deliver this via SMS/email
    });
  });

  // ---- step 2: verify the code (logs in, or creates the account) ----
  app.post('/api/auth/verify-otp', (req, res) => {
    const c = classify(req.body.identifier);
    if (!c.valid) return res.status(400).json({ error: c.error || 'Enter your email or phone number.' });

    const rec = otpStore.get(keyOf(c));
    if (!rec || rec.expiresAt < Date.now()) {
      otpStore.delete(keyOf(c));
      return res.status(400).json({ error: 'That code has expired. Please request a new one.' });
    }
    if (rec.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(keyOf(c));
      return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    }
    if (String(req.body.code || '').trim() !== rec.code) {
      rec.attempts += 1;
      return res.status(401).json({ error: 'Incorrect code. Please try again.' });
    }
    otpStore.delete(keyOf(c));

    let user = findUser(c);
    if (!user) {
      // first time in → create the customer account
      const name = String(req.body.name || '').trim() || (c.channel === 'email' ? c.email.split('@')[0] : 'New Customer');
      const uid = id('cus');
      db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(uid, 'customer', name, c.channel === 'email' ? c.email : null, c.channel === 'phone' ? formatPhone(c.digits) : null, initials(name), null, now());
      db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('cr'), uid, WELCOME_CREDIT_CENTS, 'signup', 'Welcome credit', null, now());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    }
    res.json({ user: publicUser(user) });
  });
}
