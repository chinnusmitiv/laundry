import { nanoid } from 'nanoid';
import { randomInt } from 'node:crypto';
import { db } from './db.js';
import { verifyPassword } from './crypto.js';
import { sendRealEmail, otpEmail } from './services.js';

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
  const { password_hash, push_token, ...rest } = u;
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
  // ---- step 1: request a one-time code, always sent by real email — never returned in the
  // response. If Gmail SMTP isn't configured or the send fails, the code is logged server-side
  // only, so local development isn't blocked without leaking codes to any client. ----
  app.post('/api/auth/request-otp', async (req, res) => {
    const c = classify(req.body.identifier);
    if (!c.valid) return res.status(400).json({ error: c.error });

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    otpStore.set(c.email, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });

    try {
      await sendRealEmail({ to: c.email, ...otpEmail(code) });
    } catch (e) {
      console.warn(`⚠️  OTP email to ${c.email} not sent (${e.message}) — code for local testing: ${code}`);
    }

    res.json({ sent_to: mask(c), is_new: !findUser(c) });
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
    let referralNote = null; // tells the client whether an entered referral code actually matched, since a stale/typo'd code otherwise fails completely silently
    if (!user) {
      // first time in → create the customer account
      const name = String(req.body.name || '').trim() || c.email.split('@')[0];
      const uid = id('cus');
      db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(uid, 'customer', name, c.email, null, initials(name), null, now());
      db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('cr'), uid, WELCOME_CREDIT_CENTS, 'signup', 'Welcome credit', null, now());
      // if this email was invited via someone's referral link, join them to it now —
      // the reward itself is granted once they complete their first order (see routes.js)
      const pendingRef = db.prepare(`SELECT * FROM referrals WHERE LOWER(referee_email) = ? AND status = 'sent'`).get(c.email);
      if (pendingRef) {
        db.prepare(`UPDATE referrals SET status = 'joined', referee_id = ? WHERE id = ?`).run(uid, pendingRef.id);
      } else {
        // no emailed invite pending — but they may have entered a friend's code directly
        const refCode = String(req.body.referral_code || '').trim().toUpperCase();
        if (refCode) {
          const referrer = db.prepare(`SELECT id FROM users WHERE referral_code = ?`).get(refCode);
          if (referrer && referrer.id !== uid) {
            db.prepare(
              'INSERT INTO referrals (id,referrer_id,code,referee_email,referee_id,status,reward_cents,created_at) VALUES (?,?,?,?,?,?,?,?)'
            ).run(id('ref'), referrer.id, refCode, c.email, uid, 'joined', 500, now());
            referralNote = 'applied';
          } else {
            referralNote = 'invalid';
          }
        }
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    }
    res.json({ user: publicUser(user), referral: referralNote });
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
