import { nanoid } from 'nanoid';
import { randomInt } from 'node:crypto';
import { db } from './db.js';
import { verifyPassword } from './crypto.js';

const now = () => new Date().toISOString();
const id = (p) => `${p}_${nanoid(8)}`;
const WELCOME_CREDIT_CENTS = 1000; // S$10 welcome credit on first sign-up
const OTP_TTL_MS = 5 * 60 * 1000;  // codes valid for 5 minutes
const MAX_ATTEMPTS = 5;

// in-memory one-time-password store: email -> { code, expiresAt, attempts }
// (fine for a single-process demo; cleared on restart)
const otpStore = new Map();

const initials = (name) =>
  (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const publicUser = (u) => {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
};

// validate & normalise an email identifier (customer login is email-only)
function classify(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return { valid: false, error: 'Please enter your email.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { valid: false, error: 'Please enter a valid email.' };
  return { valid: true, email: s };
}

// find an existing customer for this email
const findUser = (c) => db.prepare(`SELECT * FROM users WHERE role = 'customer' AND LOWER(email) = ?`).get(c.email);

function mask(c) {
  const [user, domain] = c.email.split('@');
  const head = user.length <= 2 ? user[0] : user.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function registerAuthRoutes(app, io) {
  // ---- step 1: request a one-time code (demo mode: code is returned to the client, not emailed) ----
  app.post('/api/auth/request-otp', (req, res) => {
    const c = classify(req.body.identifier);
    if (!c.valid) return res.status(400).json({ error: c.error });

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    otpStore.set(c.email, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });

    res.json({ sent_to: mask(c), is_new: !findUser(c), dev_code: code });
  });

  // ---- step 2: verify the code (logs in, or creates the account) ----
  app.post('/api/auth/verify-otp', (req, res) => {
    const c = classify(req.body.identifier);
    if (!c.valid) return res.status(400).json({ error: c.error });

    const rec = otpStore.get(c.email);
    if (!rec || rec.expiresAt < Date.now()) {
      otpStore.delete(c.email);
      return res.status(400).json({ error: 'That code has expired. Please request a new one.' });
    }
    if (rec.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(c.email);
      return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    }
    if (String(req.body.code || '').trim() !== rec.code) {
      rec.attempts += 1;
      return res.status(401).json({ error: 'Incorrect code. Please try again.' });
    }
    otpStore.delete(c.email);

    let user = findUser(c);
    if (!user) {
      // first time in → create the customer account
      const name = String(req.body.name || '').trim() || c.email.split('@')[0];
      const uid = id('cus');
      db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(uid, 'customer', name, c.email, null, initials(name), null, now());
      db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('cr'), uid, WELCOME_CREDIT_CENTS, 'signup', 'Welcome credit', null, now());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    }
    res.json({ user: publicUser(user) });
  });

  // ---- driver login (email + password) ----
  app.post('/api/auth/driver-login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !req.body.password) return res.status(400).json({ error: 'Enter your email and password.' });
    const driver = db.prepare(`SELECT * FROM users WHERE role = 'driver' AND LOWER(email) = ?`).get(email);
    if (!driver || !verifyPassword(req.body.password, driver.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    res.json({ user: publicUser(driver) });
  });

  // ---- ops admin login (single shared admin account) ----
  app.post('/api/auth/ops-login', (req, res) => {
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'ops_admin'`).get();
    const admin = row ? JSON.parse(row.value) : null;
    const username = String(req.body.username || '').trim().toLowerCase();
    if (!admin || username !== admin.username.toLowerCase() || !verifyPassword(req.body.password, admin.password_hash)) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    res.json({ ok: true });
  });
}
