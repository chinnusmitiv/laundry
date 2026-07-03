import { nanoid } from 'nanoid';
import { randomInt } from 'node:crypto';
import { db, STATUS_FLOW, STATUS_LABEL, GARMENT_FLOW } from './db.js';
import { payments, google, notify, stepToward, distanceKm } from './services.js';
import { searchPlaces, searchOneMap } from './places.js';
import { hashPassword } from './crypto.js';

const now = () => new Date().toISOString();
const id = (p) => `${p}_${nanoid(8)}`;
const SERVICE_FEE_CENTS = 399; // flat per-order service fee — waived for Chase Plus/Pro members
const cardBrand = (digits) => (/^4/.test(digits) ? 'Visa' : /^5[1-5]/.test(digits) ? 'Mastercard' : /^3[47]/.test(digits) ? 'Amex' : 'Card');

// ---- app settings (key/value JSON) ----
const DEFAULT_ROUTING = { auto_route: true, strategy: 'nearest', default_facility_id: null, rules: [] };
const getSetting = (key) => { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key); try { return r ? JSON.parse(r.value) : null; } catch { return null; } };
const setSetting = (key, val) => db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(val));

// pick a warehouse for an order from its address, per the routing config
function autoRouteFacility(addr) {
  const cfg = { ...DEFAULT_ROUTING, ...(getSetting('routing') || {}) };
  if (!cfg.auto_route) return null;
  const active = db.prepare('SELECT * FROM facilities WHERE active = 1').all();
  const byId = (fid) => active.find((f) => f.id === fid)?.id || null;
  if (cfg.strategy === 'default') return byId(cfg.default_facility_id);
  if (cfg.strategy === 'rules' && addr?.postcode) {
    const hit = (cfg.rules || []).find((r) => r.prefix && String(addr.postcode).startsWith(String(r.prefix)));
    if (hit) return byId(hit.facility_id);
  }
  if (cfg.strategy === 'nearest' && addr?.lat != null) {
    let best = null, bestKm = Infinity;
    for (const f of active) { if (f.lat == null) continue; const km = distanceKm(addr, f); if (km < bestKm) { bestKm = km; best = f; } }
    if (best) return best.id;
  }
  return byId(cfg.default_facility_id); // fallback
}
// promotional top-up bonus tiers — bigger top-ups earn more bonus credit
const TOPUP_TIERS = [[20000, 20], [10000, 18], [5000, 12], [2000, 5]]; // [minCents, bonusPct]
function topupBonus(amount) {
  for (const [min, pct] of TOPUP_TIERS) if (amount >= min) return { bonus: Math.floor((amount * pct) / 100), pct };
  return { bonus: 0, pct: 0 };
}

// ---- query helpers ----
const getUser = (uid) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (u) delete u.password_hash; // never expose the password hash to clients
  return u;
};
const balanceOf = (uid) =>
  db.prepare('SELECT COALESCE(SUM(amount_cents),0) b FROM credits WHERE user_id = ?').get(uid).b;
const activeSub = (uid) =>
  db.prepare(`SELECT s.*, p.name plan_name, p.discount_pct, p.free_delivery, p.included_kg, p.price_cents plan_price
              FROM subscriptions s JOIN plans p ON p.id = s.plan_id
              WHERE s.user_id = ? AND s.status = 'active'`).get(uid);

// HQ-only actions (driver assignment, customer invoicing) are gated on the acting ops console's identity.
// A warehouse console's ops user has a facility_id; HQ's does not.
const isHQOps = (opsId) => {
  if (!opsId) return false;
  const u = db.prepare(`SELECT facility_id FROM users WHERE id = ? AND role = 'ops'`).get(opsId);
  return !!u && u.facility_id == null;
};

function garmentEvents(gid) {
  return db.prepare('SELECT * FROM garment_events WHERE garment_id = ? ORDER BY ts').all(gid);
}
function logGarmentEvent(gid, status, actor = 'ops', note = null) {
  db.prepare('INSERT INTO garment_events (id,garment_id,status,actor,note,ts) VALUES (?,?,?,?,?,?)')
    .run(id('ev'), gid, status, actor, note, now());
}

function fullOrder(oid) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(oid);
  if (!o) return null;
  o.items = db.prepare('SELECT oi.*, c.unit AS catalog_unit FROM order_items oi LEFT JOIN catalog c ON c.id = oi.catalog_id WHERE oi.order_id = ?').all(oid);
  o.garments = db.prepare('SELECT * FROM garments WHERE order_id = ? ORDER BY tag_code').all(oid);
  for (const g of o.garments) g.events = garmentEvents(g.id);
  o.customer = getUser(o.customer_id);
  o.driver = o.driver_id ? getUser(o.driver_id) : null;
  o.address = o.address_id ? db.prepare('SELECT * FROM addresses WHERE id = ?').get(o.address_id) : null;
  o.facility = o.facility_id ? db.prepare('SELECT * FROM facilities WHERE id = ?').get(o.facility_id) : null;
  const tr = db.prepare(`SELECT * FROM transfers WHERE order_id = ? AND status = 'in_transit' ORDER BY created_at DESC LIMIT 1`).get(oid);
  if (tr) {
    tr.from = tr.from_facility_id ? db.prepare('SELECT * FROM facilities WHERE id = ?').get(tr.from_facility_id) : null;
    tr.to = db.prepare('SELECT * FROM facilities WHERE id = ?').get(tr.to_facility_id);
  }
  o.transfer = tr || null;
  o.status_label = STATUS_LABEL[o.status] || o.status;
  o.location = o.driver_id
    ? db.prepare('SELECT * FROM driver_locations WHERE driver_id = ? ORDER BY ts DESC LIMIT 1').get(o.driver_id)
    : null;
  return o;
}

function broadcastOrder(io, oid) {
  const o = fullOrder(oid);
  io.to(`order:${oid}`).emit('order:updated', o);
  io.to(`role:ops`).emit('order:updated', o);
  if (o?.customer_id) io.to(`user:${o.customer_id}`).emit('order:updated', o);
  if (o?.driver_id) io.to(`user:${o.driver_id}`).emit('order:updated', o);
  return o;
}

export function registerRoutes(app, io) {
  // ===========================================================
  // SHARED / LOOKUP
  // ===========================================================
  app.get('/api/users', (req, res) => {
    const { role } = req.query;
    const rows = role
      ? db.prepare('SELECT * FROM users WHERE role = ? ORDER BY name').all(role)
      : db.prepare('SELECT * FROM users ORDER BY role, name').all();
    res.json(rows.map((u) => { delete u.password_hash; return u; }));
  });
  app.get('/api/users/:id', (req, res) => res.json(getUser(req.params.id) || {}));
  // consumer apps never pass ?scope, so they only ever see the fixed B2C catalog; ops passes scope=b2b for corporate orders
  app.get('/api/catalog', (req, res) => res.json(db.prepare('SELECT * FROM catalog WHERE scope = ? ORDER BY category, name').all(req.query.scope || 'b2c')));

  // per-client negotiated B2B rates (falls back to the b2b catalog's default price when no override exists)
  app.get('/api/ops/business/:id/rates', (req, res) => {
    const catalog = db.prepare(`SELECT * FROM catalog WHERE scope = 'b2b' ORDER BY category, name`).all();
    const overrides = db.prepare('SELECT catalog_id, price_cents FROM business_rates WHERE business_id = ?').all(req.params.id);
    const byId = Object.fromEntries(overrides.map((o) => [o.catalog_id, o.price_cents]));
    res.json(catalog.map((c) => ({ ...c, rate_cents: byId[c.id] ?? c.price_cents, has_override: byId[c.id] != null })));
  });
  app.post('/api/ops/business/:id/rates', (req, res) => {
    const { catalog_id, price_cents } = req.body;
    if (price_cents == null || price_cents === '') {
      db.prepare('DELETE FROM business_rates WHERE business_id = ? AND catalog_id = ?').run(req.params.id, catalog_id);
    } else {
      db.prepare(`INSERT INTO business_rates (business_id, catalog_id, price_cents) VALUES (?,?,?)
                  ON CONFLICT(business_id, catalog_id) DO UPDATE SET price_cents = excluded.price_cents`)
        .run(req.params.id, catalog_id, Math.round(Number(price_cents)));
    }
    res.json({ ok: true });
  });

  // warehouses
  app.get('/api/facilities', (_req, res) => res.json(db.prepare('SELECT * FROM facilities WHERE active = 1 ORDER BY name').all()));

  // ---- routing configuration ----
  app.get('/api/ops/settings/routing', (_req, res) => res.json({ ...DEFAULT_ROUTING, ...(getSetting('routing') || {}) }));
  app.post('/api/ops/settings/routing', (req, res) => {
    const cur = { ...DEFAULT_ROUTING, ...(getSetting('routing') || {}) };
    const next = {
      auto_route: req.body.auto_route !== undefined ? !!req.body.auto_route : cur.auto_route,
      strategy: req.body.strategy || cur.strategy,
      default_facility_id: req.body.default_facility_id !== undefined ? (req.body.default_facility_id || null) : cur.default_facility_id,
      rules: Array.isArray(req.body.rules) ? req.body.rules.filter((r) => r.prefix && r.facility_id) : cur.rules,
    };
    setSetting('routing', next);
    res.json(next);
  });

  // ---- HQ warehouse management ----
  app.get('/api/ops/facilities', (_req, res) => {
    const rows = db.prepare('SELECT * FROM facilities ORDER BY name').all();
    res.json(rows.map((f) => ({
      ...f,
      active_orders: db.prepare("SELECT COUNT(*) c FROM orders WHERE facility_id = ? AND status NOT IN ('completed','cancelled')").get(f.id).c,
    })));
  });

  app.post('/api/ops/facilities', (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Warehouse name is required.' });
    const s = (v) => String(v || '').trim() || null;
    const fid = id('wh');
    const code = s(b.code) || ('WH-' + name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase());
    db.prepare('INSERT INTO facilities (id,code,name,line1,area,postcode,lat,lng,phone,capacity_kg,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)')
      .run(fid, code, name, s(b.line1), s(b.area), s(b.postcode), b.lat ?? null, b.lng ?? null, s(b.phone), Math.round(Number(b.capacity_kg) || 500));
    io.to('role:ops').emit('facility:new', { id: fid });
    res.json(db.prepare('SELECT * FROM facilities WHERE id = ?').get(fid));
  });

  app.post('/api/ops/facilities/:id', (req, res) => {
    const f = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
    if (!f) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    for (const k of ['name', 'code', 'line1', 'area', 'postcode', 'phone']) {
      if (b[k] !== undefined) db.prepare(`UPDATE facilities SET ${k} = ? WHERE id = ?`).run(String(b[k]).trim() || null, f.id);
    }
    if (b.capacity_kg !== undefined) db.prepare('UPDATE facilities SET capacity_kg = ? WHERE id = ?').run(Math.round(Number(b.capacity_kg) || 0), f.id);
    if (b.active !== undefined) db.prepare('UPDATE facilities SET active = ? WHERE id = ?').run(b.active ? 1 : 0, f.id);
    res.json(db.prepare('SELECT * FROM facilities WHERE id = ?').get(f.id));
  });

  // Singapore address autocomplete — real OneMap, with local dataset fallback
  app.get('/api/places/search', async (req, res) => {
    let out = await searchOneMap(req.query.q);
    if (!out.length) out = searchPlaces(req.query.q);
    res.json(out);
  });
  app.get('/api/plans', (_req, res) =>
    res.json(db.prepare('SELECT * FROM plans ORDER BY price_cents').all().map((p) => ({ ...p, perks: JSON.parse(p.perks || '[]') }))));

  // ===========================================================
  // CUSTOMER
  // ===========================================================
  app.get('/api/customers/:id/summary', (req, res) => {
    const uid = req.params.id;
    const sub = activeSub(uid);
    res.json({
      user: getUser(uid),
      balance_cents: balanceOf(uid),
      subscription: sub ? { ...sub, perks: undefined } : null,
      addresses: db.prepare('SELECT * FROM addresses WHERE user_id = ?').all(uid),
      open_orders: db.prepare(`SELECT COUNT(*) c FROM orders WHERE customer_id = ? AND status NOT IN ('completed','cancelled')`).get(uid).c,
      unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(uid).c,
    });
  });

  // add a saved address (from a places-autocomplete selection)
  app.post('/api/customers/:id/addresses', (req, res) => {
    const uid = req.params.id;
    const { label, type, line1, line2, city, postcode, lat, lng, make_default } = req.body;
    const aid = id('adr');
    if (make_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(uid);
    db.prepare('INSERT INTO addresses (id,user_id,label,type,line1,line2,city,postcode,lat,lng,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(aid, uid, label || 'New address', type || 'home', line1 ?? null, line2 ?? null, city || 'Singapore', postcode ?? null, lat ?? null, lng ?? null, make_default ? 1 : 0);
    res.json(db.prepare('SELECT * FROM addresses WHERE id = ?').get(aid));
  });

  app.get('/api/customers/:id/orders', (req, res) => {
    const rows = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(rows.map((o) => ({ ...o, status_label: STATUS_LABEL[o.status] || o.status, items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) })));
  });

  app.get('/api/orders/:id', (req, res) => {
    const o = fullOrder(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    res.json(o);
  });

  // quote pricing without committing
  app.post('/api/orders/quote', (req, res) => res.json(priceOrder(req.body)));

  // create order — consumer (app) OR B2B (warehouse, invoiced, no app account)
  app.post('/api/orders', (req, res) => {
    let { customer_id, address_id, items = [], pickup_slot, return_slot, notes, use_credit, handover, handover_contact, facility_id, driver_id, business_name, business_phone, repeat_requested, repeat_cadence } = req.body;

    // B2B: no customer account — find-or-create a lightweight business client (role='business', no login)
    const isB2B = !!(business_name && business_name.trim());
    if (isB2B) {
      const name = business_name.trim();
      let biz = db.prepare("SELECT * FROM users WHERE role = 'business' AND LOWER(name) = LOWER(?)").get(name);
      if (!biz) {
        const bid = id('biz');
        const avatar = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(bid, 'business', name, null, String(business_phone || '').trim() || null, avatar, null, now());
        biz = getUser(bid);
      } else if (business_phone) {
        db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(String(business_phone).trim(), biz.id);
      }
      customer_id = biz.id;
      use_credit = false; // businesses are invoiced, no wallet
    }

    const pricing = priceOrder({ customer_id, items, use_credit, b2b: isB2B });
    const oid = id('ord');
    const code = `CL-${1000 + db.prepare('SELECT COUNT(*) c FROM orders').get().c + 50}`;
    // auto-route to a warehouse from the address if ops didn't pick one
    if (!facility_id) {
      const addr = address_id ? db.prepare('SELECT * FROM addresses WHERE id = ?').get(address_id) : null;
      facility_id = autoRouteFacility(addr);
    }
    // B2B drops off at the warehouse → starts in processing flow; consumer flow starts at pickup
    const status = driver_id ? 'assigned' : (isB2B && facility_id ? 'at_facility' : 'placed');
    const paymentStatus = isB2B ? 'invoiced' : 'pending'; // B2B billed on terms, not pay-now
    db.prepare(`INSERT INTO orders (id,code,customer_id,address_id,driver_id,facility_id,status,pickup_slot,return_slot,notes,handover,handover_contact,
        subtotal_cents,platform_fee_cents,delivery_fee_cents,discount_cents,credit_applied_cents,total_cents,payment_status,repeat_requested,repeat_cadence,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, ?, ?, ?, ?)`)
      .run(oid, code, customer_id, address_id ?? null, driver_id ?? null, facility_id ?? null, status, pickup_slot ?? null, return_slot ?? null, notes || '', handover ?? null, handover_contact ?? null,
        pricing.subtotal_cents, pricing.platform_fee_cents, pricing.delivery_fee_cents,
        pricing.discount_cents, pricing.credit_applied_cents, pricing.total_cents, paymentStatus, repeat_requested ? 1 : 0, repeat_requested ? (repeat_cadence || 'weekly') : null, now(), now());
    if (driver_id) io.to(`user:${driver_id}`).emit('job:assigned', fullOrder(oid));
    for (const it of items) {
      const cat = db.prepare('SELECT * FROM catalog WHERE id = ?').get(it.catalog_id);
      const line = lineTotal(cat, it);
      db.prepare('INSERT INTO order_items (id,order_id,catalog_id,name,qty,weight_kg,price_cents) VALUES (?,?,?,?,?,?,?)')
        .run(id('itm'), oid, it.catalog_id, cat?.name || it.name, it.qty || 1, it.weight_kg || null, line);
    }
    // consumer-only: spend wallet credit + push an in-app notification (business has no app)
    if (!isB2B) {
      if (pricing.credit_applied_cents > 0) {
        db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
          .run(id('cr'), customer_id, -pricing.credit_applied_cents, 'spend', `Applied to ${code}`, oid, now());
      }
      notify({ io, userId: customer_id, type: 'order', title: 'Order confirm liao 🎉', body: `${code} received! We assign a driver for you shortly, don't worry ah.`, orderId: oid });
    }
    io.to('role:ops').emit('order:new', fullOrder(oid));
    res.json(fullOrder(oid));
  });

  // ---- HQ customer management ----
  // all consumer customers with aggregates
  app.get('/api/ops/customers', (_req, res) => {
    const rows = db.prepare("SELECT * FROM users WHERE role = 'customer' ORDER BY name").all();
    res.json(rows.map((u) => {
      delete u.password_hash;
      return {
        ...u,
        balance_cents: balanceOf(u.id),
        orders: db.prepare('SELECT COUNT(*) c FROM orders WHERE customer_id = ?').get(u.id).c,
        plan: activeSub(u.id)?.plan_name || 'Lite',
      };
    }));
  });

  // HQ creates a consumer customer (they can later log in via OTP with this email/phone)
  app.post('/api/ops/customers', (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim() || null;
    const phone = String(req.body.phone || '').trim() || null;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (email && db.prepare("SELECT 1 FROM users WHERE role = 'customer' AND LOWER(email) = LOWER(?)").get(email)) return res.status(409).json({ error: 'A customer with this email already exists.' });
    const uid = id('cus');
    const avatar = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(uid, 'customer', name, email, phone, avatar, null, now());
    db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id('cr'), uid, 1000, 'signup', 'Welcome credit', null, now());
    res.json(getUser(uid));
  });

  // ---- HQ B2B client management ----
  app.get('/api/ops/businesses', (_req, res) => {
    const rows = db.prepare("SELECT * FROM users WHERE role = 'business' ORDER BY name").all();
    res.json(rows.map((u) => {
      delete u.password_hash;
      const agg = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total_cents),0) t FROM orders WHERE customer_id = ?").get(u.id);
      const outstanding = db.prepare("SELECT COALESCE(SUM(total_cents),0) t FROM orders WHERE customer_id = ? AND payment_status != 'paid'").get(u.id).t;
      return { ...u, orders: agg.c, billed_cents: agg.t, outstanding_cents: outstanding };
    }));
  });

  app.post('/api/ops/businesses', (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Business name is required.' });
    if (db.prepare("SELECT 1 FROM users WHERE role = 'business' AND LOWER(name) = LOWER(?)").get(name)) return res.status(409).json({ error: 'This business already exists.' });
    const bid = id('biz');
    const avatar = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const s = (v) => String(v || '').trim() || null;
    db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,address,contact_person,gst_no,payment_terms,facility_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(bid, 'business', name, s(b.email), s(b.phone), avatar, s(b.address), s(b.contact_person), s(b.gst_no), s(b.payment_terms) || 'Net 30', null, now());
    res.json(getUser(bid));
  });

  // update a client's profile (B2B details)
  app.post('/api/ops/clients/:id', (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    const fields = ['name', 'email', 'phone', 'address', 'contact_person', 'gst_no', 'payment_terms'];
    for (const f of fields) {
      if (b[f] !== undefined) db.prepare(`UPDATE users SET ${f} = ? WHERE id = ?`).run(String(b[f]).trim() || null, u.id);
    }
    res.json(getUser(u.id));
  });

  app.post('/api/orders/:id/pay', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const pay = payments.charge({ orderId: o.id, amountCents: o.total_cents, customer: getUser(o.customer_id) });
    db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').run('paid', now(), o.id);
    notify({ io, userId: o.customer_id, type: 'payment', title: 'Payment received', body: `S$${(o.total_cents / 100).toFixed(2)} paid for ${o.code}.`, orderId: o.id });
    res.json({ ok: true, payment: pay, order: broadcastOrder(io, o.id) });
  });

  // ---- Stripe-shaped payment with simulated 3D Secure (SCA) ----
  // Generic: the client runs this to "charge a card"; the actual business
  // action (mark order paid / activate subscription) is a separate call.
  app.post('/api/payments/intent', (req, res) => {
    res.json(payments.createIntent({ amountCents: req.body.amount_cents || 0, description: req.body.description || 'Payment' }));
  });

  app.post('/api/payments/confirm', (req, res) => {
    const digits = String(req.body.card || '').replace(/\D/g, '');
    const code = String(req.body.code || '').trim();
    if (digits.length < 12) return res.status(400).json({ status: 'failed', error: 'Enter a valid card number.' });

    // Stripe-style test cards
    if (digits === '4000000000009995') return res.status(402).json({ status: 'failed', error: 'Your card was declined (insufficient funds).' });
    const needs3ds = digits === '4000002500003155';

    // step 1 — card needs Strong Customer Authentication
    if (needs3ds && !code) {
      return res.json({
        status: 'requires_action',
        next_action: 'use_stripe_sdk',
        auth: { bank: 'ChaseBank', brand: cardBrand(digits), masked: digits.slice(-4), demo_code: String(randomInt(0, 1000000)).padStart(6, '0') },
      });
    }
    // step 2 — authentication submitted
    if (needs3ds && !/^\d{6}$/.test(code)) {
      return res.status(401).json({ status: 'failed', error: 'Authentication failed — enter the 6-digit code.' });
    }
    const pay = payments.charge({ orderId: 'pay', amountCents: req.body.amount_cents || 0, customer: { email: req.body.email } });
    res.json({ status: 'succeeded', payment: pay, brand: cardBrand(digits), last4: digits.slice(-4) });
  });

  // wallet / credits
  app.get('/api/customers/:id/credits', (req, res) => {
    res.json({
      balance_cents: balanceOf(req.params.id),
      ledger: db.prepare('SELECT * FROM credits WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id),
    });
  });

  // top up wallet credit (after a Stripe payment) — with promotional bonus tiers
  app.post('/api/customers/:id/topup', (req, res) => {
    const uid = req.params.id;
    const amount = Math.max(0, Math.round(Number(req.body.amount_cents) || 0));
    if (amount < 500) return res.status(400).json({ error: 'Minimum top-up is S$5.' });
    const { bonus, pct } = topupBonus(amount);
    payments.charge({ orderId: 'topup', amountCents: amount, customer: getUser(uid) });
    db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id('cr'), uid, amount, 'topup', 'Wallet top-up', null, now());
    if (bonus > 0) {
      db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('cr'), uid, bonus, 'bonus', `Top-up bonus (+${pct}%)`, null, now());
    }
    notify({ io, userId: uid, type: 'payment', title: 'Wallet topped up 🎉', body: `S$${(amount / 100).toFixed(2)} added${bonus > 0 ? ` + S$${(bonus / 100).toFixed(2)} bonus credit` : ''}.` });
    res.json({ balance_cents: balanceOf(uid), added_cents: amount, bonus_cents: bonus });
  });

  // referrals
  app.get('/api/customers/:id/referrals', (req, res) => {
    const u = getUser(req.params.id);
    const code = (u?.name || 'CHASE').split(' ')[0].toUpperCase() + '-CHASE';
    res.json({
      code,
      reward_cents: 500,
      referrals: db.prepare('SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC').all(req.params.id),
    });
  });
  app.post('/api/customers/:id/referrals', (req, res) => {
    const u = getUser(req.params.id);
    const code = (u?.name || 'CHASE').split(' ')[0].toUpperCase() + '-CHASE';
    const r = { id: id('ref'), referrer_id: req.params.id, code, referee_email: req.body.email, status: 'sent', reward_cents: 500, created_at: now() };
    db.prepare('INSERT INTO referrals (id,referrer_id,code,referee_email,status,reward_cents,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(r.id, r.referrer_id, r.code, r.referee_email, r.status, r.reward_cents, r.created_at);
    res.json(r);
  });

  // subscriptions
  app.post('/api/customers/:id/subscription', (req, res) => {
    const uid = req.params.id;
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.body.plan_id);
    if (!plan) return res.status(400).json({ error: 'bad plan' });
    db.prepare(`UPDATE subscriptions SET status='cancelled' WHERE user_id=? AND status='active'`).run(uid);
    if (plan.id !== 'plan_lite') {
      payments.createSubscription({ user: getUser(uid), plan });
      db.prepare('INSERT INTO subscriptions (id,user_id,plan_id,status,started_at,renews_at) VALUES (?,?,?,?,?,?)')
        .run(id('sub'), uid, plan.id, 'active', now(), new Date(Date.now() + 30 * 864e5).toISOString());
    }
    notify({ io, userId: uid, type: 'subscription', title: `You're on ${plan.name}`, body: plan.id === 'plan_lite' ? 'Switched to pay-as-you-go.' : `Welcome to ChaseLaundry ${plan.name}.` });
    res.json({ ok: true, subscription: activeSub(uid) });
  });

  // cancel active subscription
  app.post('/api/customers/:id/subscription/cancel', (req, res) => {
    const uid = req.params.id;
    db.prepare(`UPDATE subscriptions SET status='cancelled' WHERE user_id=? AND status='active'`).run(uid);
    notify({ io, userId: uid, type: 'subscription', title: 'Subscription cancelled', body: 'Your subscription has been cancelled.' });
    res.json({ ok: true, subscription: activeSub(uid) });
  });

  // notifications
  app.get('/api/customers/:id/notifications', (req, res) =>
    res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id)));
  app.post('/api/notifications/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/customers/:id/notifications/read-all', (req, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // support chat
  app.get('/api/customers/:id/threads', (req, res) =>
    res.json(db.prepare('SELECT * FROM support_threads WHERE customer_id = ? ORDER BY updated_at DESC').all(req.params.id)));
  app.get('/api/threads/:id', (req, res) => {
    const t = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'not found' });
    t.messages = db.prepare('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at').all(t.id);
    res.json(t);
  });
  app.post('/api/customers/:id/threads', (req, res) => {
    const uid = req.params.id;
    // Defensive check: ensure user exists (fixes mismatch issues with old local storage sessions)
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(uid)) {
      const name = uid.startsWith('ops_') ? uid.replace('ops_', '').toUpperCase() + ' — Ops' : 'Customer';
      db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)')
        .run(uid, 'ops', name, uid + '@chaselaundry.com', '', 'OP', now());
    }
    const t = { id: id('thr'), customer_id: uid, subject: req.body.subject || 'New conversation', status: 'open', order_id: req.body.order_id || null, created_at: now(), updated_at: now() };
    db.prepare('INSERT INTO support_threads (id,customer_id,subject,status,order_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(t.id, t.customer_id, t.subject, t.status, t.order_id, t.created_at, t.updated_at);
    if (req.body.body) addMessage(io, t.id, 'customer', uid, req.body.body);
    io.to('role:ops').emit('thread:new', t);
    res.json(t);
  });
  app.post('/api/threads/:id/messages', (req, res) => {
    const { sender_role, sender_id, body } = req.body;
    const msg = addMessage(io, req.params.id, sender_role, sender_id, body);
    res.json(msg);
  });
  app.post('/api/threads/:id/status', (req, res) => {
    const { status } = req.body;
    db.prepare('UPDATE support_threads SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), req.params.id);
    const msgId = `msg_${nanoid(8)}`;
    const textStatus = status.replace('_', ' ').toUpperCase();
    db.prepare('INSERT INTO support_messages (id,thread_id,sender_role,sender_id,body,created_at) VALUES (?,?,?,?,?,?)')
      .run(msgId, req.params.id, 'system', 'system', `Thread status changed to: ${textStatus}`, now());
    const thread = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(req.params.id);
    io.to(`thread:${req.params.id}`).emit('support:message', { id: msgId, thread_id: req.params.id, sender_role: 'system', body: `Thread status changed to: ${textStatus}`, created_at: now() });
    io.to('role:ops').emit('support:message', { id: msgId, thread_id: req.params.id, sender_role: 'system', body: `Thread status changed to: ${textStatus}`, created_at: now() });
    if (thread) {
      io.to(`user:${thread.customer_id}`).emit('support:message', { id: msgId, thread_id: req.params.id, sender_role: 'system', body: `Thread status changed to: ${textStatus}`, created_at: now() });
    }
    res.json({ ok: true });
  });

  // reviews (customer rating)
  app.post('/api/orders/:id/review', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const r = { id: id('rev'), order_id: o.id, customer_id: o.customer_id, driver_id: o.driver_id, rating: req.body.rating, comment: req.body.comment || '', google_linked: req.body.google_linked ? 1 : 0, created_at: now() };
    db.prepare('INSERT INTO reviews (id,order_id,customer_id,driver_id,rating,comment,google_linked,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(r.id, r.order_id, r.customer_id, r.driver_id, r.rating, r.comment, r.google_linked, r.created_at);
    res.json(r);
  });

  // ===========================================================
  // DRIVER
  // ===========================================================
  app.get('/api/drivers/:id/shift', (req, res) =>
    res.json(db.prepare(`SELECT * FROM shifts WHERE driver_id = ? AND status='active' ORDER BY clock_in DESC LIMIT 1`).get(req.params.id) || null));

  app.post('/api/drivers/:id/clock-in', (req, res) => {
    const { lat, lng } = req.body || {};
    const existing = db.prepare(`SELECT * FROM shifts WHERE driver_id=? AND status='active'`).get(req.params.id);
    if (existing) return res.json(existing);
    const shift = { id: id('shf'), driver_id: req.params.id, clock_in: now(), clock_out: null, start_lat: lat, start_lng: lng, status: 'active' };
    db.prepare('INSERT INTO shifts (id,driver_id,clock_in,clock_out,start_lat,start_lng,status) VALUES (?,?,?,?,?,?,?)')
      .run(shift.id, shift.driver_id, shift.clock_in, shift.clock_out, lat, lng, shift.status);
    io.to('role:ops').emit('driver:shift', { driver_id: req.params.id, status: 'active' });
    res.json(shift);
  });

  app.post('/api/drivers/:id/clock-out', (req, res) => {
    db.prepare(`UPDATE shifts SET status='ended', clock_out=? WHERE driver_id=? AND status='active'`).run(now(), req.params.id);
    io.to('role:ops').emit('driver:shift', { driver_id: req.params.id, status: 'ended' });
    res.json({ ok: true });
  });

  app.get('/api/drivers/:id/jobs', (req, res) => {
    const rows = db.prepare(`SELECT * FROM orders WHERE driver_id = ? AND status NOT IN ('completed','cancelled') ORDER BY created_at`).all(req.params.id);
    res.json(rows.map((o) => fullOrder(o.id)));
  });

  // driver pushes a gps ping (live tracking)
  app.post('/api/drivers/:id/location', (req, res) => {
    const { lat, lng, order_id } = req.body;
    const loc = { id: id('loc'), driver_id: req.params.id, order_id: order_id || null, lat, lng, ts: now() };
    db.prepare('INSERT INTO driver_locations (id,driver_id,order_id,lat,lng,ts) VALUES (?,?,?,?,?,?)')
      .run(loc.id, loc.driver_id, loc.order_id, lat, lng, loc.ts);
    io.to('role:ops').emit('driver:location', loc);
    if (order_id) io.to(`order:${order_id}`).emit('driver:location', loc);
    res.json(loc);
  });

  // google review deep link for a delivered order (driver shows QR)
  app.get('/api/orders/:id/review-link', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    res.json({ url: google.reviewLink(o.code), code: o.code });
  });

  // ===========================================================
  // ORDER STATUS (driver + ops). Validates against STATUS_FLOW.
  // ===========================================================
  app.post('/api/orders/:id/status', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const next = req.body.status;
    if (!STATUS_FLOW.includes(next) && next !== 'cancelled') return res.status(400).json({ error: 'bad status' });
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(next, now(), o.id);
    notify({ io, userId: o.customer_id, type: 'order', title: STATUS_LABEL[next], body: `Order ${o.code}: ${STATUS_LABEL[next]}.`, orderId: o.id });
    res.json(broadcastOrder(io, o.id));
  });

  // ===========================================================
  // OPS
  // ===========================================================
  app.get('/api/ops/orders', (req, res) => {
    const { status, facility_id } = req.query;
    // a warehouse console only sees orders routed to it; HQ (no facility_id) sees all
    const where = [];
    const args = [];
    if (status) { where.push('status = ?'); args.push(status); }
    if (facility_id) { where.push('facility_id = ?'); args.push(facility_id); }
    const sql = `SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const rows = db.prepare(sql).all(...args);
    res.json(rows.map((o) => fullOrder(o.id)));
  });

  app.get('/api/ops/stats', (req, res) => {
    const fid = req.query.facility_id;
    // scope every metric to a warehouse when facility_id is given
    const fc = fid ? ' AND facility_id = ?' : '';
    const fa = fid ? [fid] : [];
    const c = (q, ...a) => db.prepare(q).get(...a).c;
    res.json({
      active: c(`SELECT COUNT(*) c FROM orders WHERE status NOT IN ('completed','cancelled')${fc}`, ...fa),
      unassigned: fid
        ? c(`SELECT COUNT(*) c FROM orders WHERE driver_id IS NULL AND status NOT IN ('completed','cancelled') AND facility_id = ?`, fid)
        : c(`SELECT COUNT(*) c FROM orders WHERE facility_id IS NULL AND status NOT IN ('completed','cancelled')`),
      at_facility: c(`SELECT COUNT(*) c FROM orders WHERE status IN ('at_facility','processing','ready')${fc}`, ...fa),
      in_transit: fid
        ? c(`SELECT COUNT(*) c FROM transfers WHERE status='in_transit' AND (to_facility_id=? OR from_facility_id=?)`, fid, fid)
        : c(`SELECT COUNT(*) c FROM transfers WHERE status='in_transit'`),
      drivers_on_shift: c(`SELECT COUNT(*) c FROM shifts WHERE status='active'`),
      revenue_cents: db.prepare(`SELECT COALESCE(SUM(total_cents),0) c FROM orders WHERE payment_status='paid'${fc}`).get(...fa).c,
      open_threads: c(`SELECT COUNT(*) c FROM support_threads WHERE status='open'`),
    });
  });

  app.get('/api/ops/drivers', (_req, res) => {
    const drivers = db.prepare(`SELECT * FROM users WHERE role='driver' ORDER BY name`).all();
    res.json(drivers.map((d) => { delete d.password_hash; return {
      ...d,
      shift: db.prepare(`SELECT * FROM shifts WHERE driver_id=? AND status='active' LIMIT 1`).get(d.id) || null,
      active_jobs: db.prepare(`SELECT COUNT(*) c FROM orders WHERE driver_id=? AND status NOT IN ('completed','cancelled')`).get(d.id).c,
      location: db.prepare('SELECT * FROM driver_locations WHERE driver_id=? ORDER BY ts DESC LIMIT 1').get(d.id) || null,
    }; }));
  });

  // recent jobs for one driver — lets HQ spot patterns/complaints (default: last 30 days)
  app.get('/api/drivers/:id/history', (req, res) => {
    const days = Math.max(1, parseInt(req.query.days, 10) || 30);
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const rows = db.prepare(`SELECT * FROM orders WHERE driver_id = ? AND created_at >= ? ORDER BY created_at DESC`).all(req.params.id, since);
    res.json(rows.map((o) => ({
      id: o.id, code: o.code, status: o.status, status_label: STATUS_LABEL[o.status] || o.status,
      total_cents: o.total_cents, created_at: o.created_at,
      customer: getUser(o.customer_id),
      review: db.prepare('SELECT rating, comment FROM reviews WHERE order_id = ?').get(o.id) || null,
    })));
  });

  // HQ adds a new driver to the fleet
  app.post('/api/ops/drivers', (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Driver name is required.' });
    const avatar = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const uid = id('drv');
    db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(uid, 'driver', name, String(req.body.email || '').trim() || null, String(req.body.phone || '').trim() || null, avatar, null,
        hashPassword(String(req.body.password || '').trim() || 'password'), now());
    const driver = getUser(uid);
    io.to('role:ops').emit('driver:shift', { driver_id: uid }); // nudge ops lists to refresh
    res.json(driver);
  });

  app.post('/api/orders/:id/assign', (req, res) => {
    if (!isHQOps(req.body.ops_id)) return res.status(403).json({ error: 'Only HQ can assign drivers.' });
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    db.prepare('UPDATE orders SET driver_id = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(req.body.driver_id, o.status === 'placed' ? 'assigned' : o.status, now(), o.id);
    const driver = getUser(req.body.driver_id);
    notify({ io, userId: o.customer_id, type: 'order', title: 'Driver assigned', body: `${driver?.name} will take care of ${o.code}. Steady!`, orderId: o.id });
    io.to(`user:${req.body.driver_id}`).emit('job:assigned', fullOrder(o.id));
    res.json(broadcastOrder(io, o.id));
  });

  // assign / route an order to a warehouse (manual, by ops/HQ)
  app.post('/api/orders/:id/assign-facility', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    db.prepare('UPDATE orders SET facility_id = ?, updated_at = ? WHERE id = ?').run(req.body.facility_id || null, now(), o.id);
    const fac = req.body.facility_id ? db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.body.facility_id) : null;
    notify({ io, userId: o.customer_id, type: 'order', title: 'Routing confirmed', body: `Order ${o.code} will be processed at our ${fac?.name || 'facility'}.`, orderId: o.id });
    res.json(broadcastOrder(io, o.id));
  });

  // ---- inter-warehouse transfers ----
  // send an order to another warehouse (specialist work, load balancing)
  app.post('/api/orders/:id/transfer', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const { to_facility_id, reason, created_by } = req.body;
    const to = db.prepare('SELECT * FROM facilities WHERE id = ?').get(to_facility_id);
    if (!to) return res.status(400).json({ error: 'bad destination' });
    if (to_facility_id === o.facility_id) return res.status(400).json({ error: 'already at that warehouse' });
    // one active transfer at a time
    db.prepare(`UPDATE transfers SET status='cancelled' WHERE order_id=? AND status='in_transit'`).run(o.id);
    const tid = id('trf');
    db.prepare('INSERT INTO transfers (id,order_id,from_facility_id,to_facility_id,reason,status,created_by,created_at,received_at) VALUES (?,?,?,?,?,?,?,?,NULL)')
      .run(tid, o.id, o.facility_id || null, to_facility_id, reason || null, 'in_transit', created_by || 'ops', now());
    // order stays at source until the destination confirms receipt
    const fac = o.facility_id ? db.prepare('SELECT * FROM facilities WHERE id = ?').get(o.facility_id) : null;
    notify({ io, userId: o.customer_id, type: 'order', title: 'Transferring for specialist care', body: `Order ${o.code} is moving${fac ? ` from ${fac.name}` : ''} to our ${to.name}.`, orderId: o.id });
    io.to('role:ops').emit('transfer:new', { id: tid, order_id: o.id, order_code: o.code, to_facility_id, from_facility_id: o.facility_id });
    res.json(broadcastOrder(io, o.id));
  });

  // destination warehouse confirms receipt → order now lives there
  app.post('/api/transfers/:id/receive', (req, res) => {
    const t = db.prepare('SELECT * FROM transfers WHERE id = ?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'not found' });
    if (t.status !== 'in_transit') return res.status(400).json({ error: 'not in transit' });
    db.prepare(`UPDATE transfers SET status='received', received_at=? WHERE id=?`).run(now(), t.id);
    db.prepare('UPDATE orders SET facility_id = ?, updated_at = ? WHERE id = ?').run(t.to_facility_id, now(), t.order_id);
    io.to('role:ops').emit('transfer:updated', { id: t.id, status: 'received' });
    res.json(broadcastOrder(io, t.order_id));
  });

  // transfers list — incoming/outgoing for a warehouse, or all for HQ
  app.get('/api/ops/transfers', (req, res) => {
    const fid = req.query.facility_id;
    const rows = fid
      ? db.prepare(`SELECT * FROM transfers WHERE status='in_transit' AND (to_facility_id=? OR from_facility_id=?) ORDER BY created_at DESC`).all(fid, fid)
      : db.prepare(`SELECT * FROM transfers WHERE status='in_transit' ORDER BY created_at DESC`).all();
    res.json(rows.map((t) => ({
      ...t,
      direction: fid ? (t.to_facility_id === fid ? 'incoming' : 'outgoing') : 'all',
      order: db.prepare('SELECT code, status FROM orders WHERE id = ?').get(t.order_id),
      from: t.from_facility_id ? db.prepare('SELECT name,code FROM facilities WHERE id = ?').get(t.from_facility_id) : null,
      to: db.prepare('SELECT name,code FROM facilities WHERE id = ?').get(t.to_facility_id),
    })));
  });

  // ---- garment tagging + tracking ----
  // intake: check in & tag a garment (optionally with weight + care note)
  app.post('/api/orders/:id/garments', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const count = db.prepare('SELECT COUNT(*) c FROM garments WHERE order_id = ?').get(o.id).c;
    const g = {
      id: id('grm'), order_id: o.id, tag_code: `${o.code}-${String(count + 1).padStart(2, '0')}`,
      type: req.body.type ?? null, color: req.body.color ?? null,
      weight_kg: req.body.weight_kg ?? null, care: req.body.care ?? null,
      status: 'checked_in', notes: req.body.notes || '', updated_at: now(),
    };
    db.prepare('INSERT INTO garments (id,order_id,tag_code,type,color,weight_kg,care,status,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(g.id, g.order_id, g.tag_code, g.type, g.color, g.weight_kg, g.care, g.status, g.notes, g.updated_at);
    logGarmentEvent(g.id, 'checked_in', req.body.actor || 'ops', 'Checked in & tagged');
    broadcastOrder(io, o.id);
    io.to(`order:${o.id}`).emit('garment:updated', { ...g, events: garmentEvents(g.id) });
    res.json(g);
  });

  // load wash (per-kg lines): facility records the actual weighed total — drives facility payout, distinct from the customer's checkout estimate
  app.post('/api/order_items/:id/weight', (req, res) => {
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    const actual = Math.max(0, Number(req.body.actual_weight_kg) || 0);
    db.prepare('UPDATE order_items SET actual_weight_kg = ? WHERE id = ?').run(actual, item.id);
    res.json(broadcastOrder(io, item.order_id));
  });

  // by-the-bag B2B lines (gym/salon/massage towels): facility records bags actually received & cleaned
  app.post('/api/order_items/:id/actual-qty', (req, res) => {
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    const actual = Math.max(0, parseInt(req.body.actual_qty, 10) || 0);
    db.prepare('UPDATE order_items SET actual_qty = ? WHERE id = ?').run(actual, item.id);
    res.json(broadcastOrder(io, item.order_id));
  });

  // generate a printable tag per item (used by HQ/driver to print & scan)
  app.post('/api/orders/:id/generate-tags', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const existing = db.prepare('SELECT COUNT(*) c FROM garments WHERE order_id = ?').get(o.id).c;
    if (existing === 0) {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      let n = 0;
      for (const it of items) {
        const qty = it.weight_kg ? 1 : (it.qty || 1); // weight items get 1 bag tag
        for (let k = 0; k < qty; k++) {
          n += 1;
          const gid = id('grm');
          const tag = `${o.code}-${String(n).padStart(2, '0')}`;
          db.prepare('INSERT INTO garments (id,order_id,tag_code,type,color,weight_kg,care,status,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .run(gid, o.id, tag, it.name, null, it.weight_kg || null, null, 'checked_in', '', now());
          logGarmentEvent(gid, 'checked_in', req.body.actor || 'ops', 'Tag printed');
        }
      }
      broadcastOrder(io, o.id);
    }
    res.json(db.prepare('SELECT * FROM garments WHERE order_id = ? ORDER BY tag_code').all(o.id));
  });

  // single garment with its full journey
  app.get('/api/garments/:id', (req, res) => {
    const g = db.prepare('SELECT * FROM garments WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ error: 'not found' });
    g.events = garmentEvents(g.id);
    g.order = db.prepare('SELECT code, customer_id FROM orders WHERE id = ?').get(g.order_id);
    res.json(g);
  });

  // lookup by tag code (scan station types/scans the code)
  app.get('/api/garments/by-tag/:tag', (req, res) => {
    const g = db.prepare('SELECT * FROM garments WHERE tag_code = ?').get(req.params.tag.toUpperCase());
    if (!g) return res.status(404).json({ error: 'tag not found' });
    g.events = garmentEvents(g.id);
    g.order = fullOrder(g.order_id);
    res.json(g);
  });

  function setGarmentStatus(g, status, actor, note) {
    db.prepare('UPDATE garments SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), g.id);
    logGarmentEvent(g.id, status, actor || 'ops', note || null);
    const updated = { ...g, status, events: garmentEvents(g.id) };
    io.to(`order:${g.order_id}`).emit('garment:updated', updated);
    broadcastOrder(io, g.order_id);
    return updated;
  }

  // set a specific stage
  app.post('/api/garments/:id/status', (req, res) => {
    const g = db.prepare('SELECT * FROM garments WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ error: 'not found' });
    if (!GARMENT_FLOW.includes(req.body.status)) return res.status(400).json({ error: 'bad stage' });
    res.json(setGarmentStatus(g, req.body.status, req.body.actor, req.body.note));
  });

  // advance to the next stage (scan-to-progress)
  app.post('/api/garments/:id/advance', (req, res) => {
    const g = db.prepare('SELECT * FROM garments WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ error: 'not found' });
    const next = GARMENT_FLOW[GARMENT_FLOW.indexOf(g.status) + 1];
    if (!next) return res.status(400).json({ error: 'already at final stage' });
    res.json(setGarmentStatus(g, next, req.body.actor || 'scan', req.body.note));
  });

  // advance by tag code (the scan endpoint a barcode scanner would hit)
  app.post('/api/garments/by-tag/:tag/advance', (req, res) => {
    const g = db.prepare('SELECT * FROM garments WHERE tag_code = ?').get(req.params.tag.toUpperCase());
    if (!g) return res.status(404).json({ error: 'tag not found' });
    const next = GARMENT_FLOW[GARMENT_FLOW.indexOf(g.status) + 1];
    if (!next) return res.json({ ...g, events: garmentEvents(g.id), note: 'already final' });
    res.json(setGarmentStatus(g, next, 'scan', `Scanned at ${next} station`));
  });

  // ops grants in-store credit
  app.post('/api/customers/:id/credit', (req, res) => {
    const amount = Math.round((req.body.amount || 0) * 100);
    db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id('cr'), req.params.id, amount, req.body.type || 'in_store', req.body.reason || 'In-store credit', null, now());
    notify({ io, userId: req.params.id, type: 'credit', title: 'Credit added 💚', body: `S$${(amount / 100).toFixed(2)} ${req.body.reason || 'credit'} added to your wallet. Shiok!` });
    res.json({ ok: true, balance_cents: balanceOf(req.params.id) });
  });

  // ops support inbox
  app.get('/api/ops/threads', (_req, res) => {
    const rows = db.prepare('SELECT * FROM support_threads ORDER BY updated_at DESC').all();
    res.json(rows.map((t) => ({ ...t, customer: getUser(t.customer_id), last: db.prepare('SELECT * FROM support_messages WHERE thread_id=? ORDER BY created_at DESC LIMIT 1').get(t.id) })));
  });

  // GET facility pricing
  app.get('/api/ops/pricing/:facilityId', (req, res) => {
    const fid = req.params.facilityId;
    const catalog = db.prepare('SELECT * FROM catalog ORDER BY category, name').all();
    const pricing = db.prepare('SELECT * FROM facility_pricing WHERE facility_id = ?').all(fid);
    const pricingMap = {};
    for (const p of pricing) pricingMap[p.catalog_id] = p.cost_cents;

    const result = catalog.map((c) => {
      const cost = pricingMap[c.id] !== undefined ? pricingMap[c.id] : Math.round(c.price_cents * 0.70);
      return {
        catalog_id: c.id,
        name: c.name,
        category: c.category,
        unit: c.unit,
        retail_cents: c.price_cents,
        cost_cents: cost,
        icon: c.icon,
      };
    });
    res.json(result);
  });

  // POST facility pricing updates
  app.post('/api/ops/pricing/:facilityId', (req, res) => {
    const fid = req.params.facilityId;
    const items = req.body; // array of { catalog_id, cost_cents }
    const ins = db.prepare('INSERT OR REPLACE INTO facility_pricing (facility_id, catalog_id, cost_cents) VALUES (?, ?, ?)');
    for (const item of items) {
      ins.run(fid, item.catalog_id, item.cost_cents);
    }
    res.json({ ok: true });
  });

  // GET invoicing reports
  app.get('/api/ops/invoices', (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // e.g. "2026-06"
    const fid = req.query.facility_id || null;

    let sql = `SELECT * FROM orders WHERE status = 'completed' AND substr(created_at, 1, 7) = ?`;
    const args = [month];
    if (fid) {
      sql += ` AND facility_id = ?`;
      args.push(fid);
    }
    const orders = db.prepare(sql).all(...args);

    const facilities = fid
      ? [db.prepare('SELECT * FROM facilities WHERE id = ?').get(fid)]
      : db.prepare('SELECT * FROM facilities').all();

    const summaries = [];
    for (const fac of facilities) {
      if (!fac) continue;
      const facOrders = orders.filter((o) => o.facility_id === fac.id);
      let totalCustomerRevenue = 0;
      let totalPayoutCost = 0;
      const orderBreakdowns = [];

      const pricing = db.prepare('SELECT * FROM facility_pricing WHERE facility_id = ?').all(fac.id);
      const pricingMap = {};
      for (const p of pricing) pricingMap[p.catalog_id] = p.cost_cents;

      for (const o of facOrders) {
        totalCustomerRevenue += o.total_cents;
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
        let orderCost = 0;
        const itemsList = [];

        for (const it of items) {
          const cat = db.prepare('SELECT * FROM catalog WHERE id = ?').get(it.catalog_id);
          const costPerUnit = pricingMap[it.catalog_id] !== undefined
            ? pricingMap[it.catalog_id]
            : (cat ? Math.round(cat.price_cents * 0.70) : 0);

          let lineCost = 0;
          if (cat) {
            if (cat.unit === 'per_kg') {
              // load wash: the facility's actual weighed total (once recorded) drives payout, not the customer's checkout estimate
              lineCost = Math.round(costPerUnit * (it.actual_weight_kg ?? it.weight_kg ?? 0));
            } else if (cat.unit === 'per_bag') {
              // by-the-bag B2B towels: the facility's actual bag count (once recorded) drives payout
              lineCost = costPerUnit * (it.actual_qty ?? it.qty ?? 1);
            } else {
              lineCost = costPerUnit * (it.qty || 1);
            }
          }
          orderCost += lineCost;
          itemsList.push({
            ...it,
            unit: cat?.unit || null,
            cost_per_unit: costPerUnit,
            line_cost: lineCost,
          });
        }
        totalPayoutCost += orderCost;
        orderBreakdowns.push({
          id: o.id,
          code: o.code,
          customer_name: db.prepare('SELECT name FROM users WHERE id = ?').get(o.customer_id)?.name || 'Unknown',
          created_at: o.created_at,
          retail_total: o.total_cents,
          payout_total: orderCost,
          items: itemsList,
        });
      }

      summaries.push({
        facility_id: fac.id,
        facility_name: fac.name,
        facility_code: fac.code,
        order_count: facOrders.length,
        customer_revenue: totalCustomerRevenue,
        payout_cost: totalPayoutCost,
        margin: totalCustomerRevenue - totalPayoutCost,
        orders: orderBreakdowns,
      });
    }

    res.json({ month, summaries });
  });

  // ===========================================================
  // DEMO HELPER: simulate driver driving toward a customer
  // (steps the driver location toward the order address & advances status)
  // ===========================================================
  app.post('/api/demo/orders/:id/simulate-drive', (req, res) => {
    const o = fullOrder(req.params.id);
    if (!o || !o.driver_id || !o.address) return res.status(400).json({ error: 'need driver + address' });
    const last = o.location || { lat: 1.3521, lng: 103.8198 };
    const next = stepToward({ lat: last.lat, lng: last.lng }, { lat: o.address.lat, lng: o.address.lng }, 0.25);
    db.prepare('INSERT INTO driver_locations (id,driver_id,order_id,lat,lng,ts) VALUES (?,?,?,?,?,?)')
      .run(id('loc'), o.driver_id, o.id, next.lat, next.lng, now());
    const km = distanceKm(next, { lat: o.address.lat, lng: o.address.lng });
    io.to(`order:${o.id}`).emit('driver:location', { ...next, driver_id: o.driver_id, order_id: o.id, eta_km: km });
    io.to('role:ops').emit('driver:location', { ...next, driver_id: o.driver_id, order_id: o.id });
    res.json({ location: next, eta_km: km });
  });

  // spin up a demo order already out-for-delivery with a driver ~3km away,
  // so customer/web/ops can immediately watch live tracking
  app.post('/api/demo/customers/:id/spawn-tracking', (req, res) => {
    const uid = req.params.id;
    if (!getUser(uid)) return res.status(404).json({ error: 'no such customer' });
    let addr = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC LIMIT 1').get(uid);
    if (!addr) {
      const aid = id('adr');
      db.prepare('INSERT INTO addresses (id,user_id,label,type,line1,line2,city,postcode,lat,lng,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,1)')
        .run(aid, uid, 'Home', 'home', '78 Tiong Bahru Road', '#12-04', 'Singapore', '168732', 1.2847, 103.8270);
      addr = db.prepare('SELECT * FROM addresses WHERE id = ?').get(aid);
    }
    const driver = db.prepare("SELECT * FROM users WHERE role = 'driver' ORDER BY name LIMIT 1").get();
    const fac = db.prepare('SELECT * FROM facilities WHERE active = 1 LIMIT 1').get();
    const cat = db.prepare('SELECT * FROM catalog LIMIT 1').get();
    const oid = id('ord');
    const code = `CL-${1000 + db.prepare('SELECT COUNT(*) c FROM orders').get().c + 50}`;
    db.prepare(`INSERT INTO orders (id,code,customer_id,address_id,driver_id,facility_id,status,pickup_slot,return_slot,notes,handover,handover_contact,
        subtotal_cents,platform_fee_cents,delivery_fee_cents,discount_cents,credit_applied_cents,total_cents,payment_status,created_at,updated_at)
      VALUES (?,?,?,?,?,?, 'out_for_delivery', ?,?,?,?,?, ?,?,?,?,?,?, 'paid', ?, ?)`)
      .run(oid, code, uid, addr.id, driver?.id ?? null, fac?.id ?? null, 'Today · 18:00–20:00', 'Today · 20:00–22:00', 'Demo live-tracking order', 'leave_at_door', null,
        1400, 99, 0, 0, 0, 1499, now(), now());
    db.prepare('INSERT INTO order_items (id,order_id,catalog_id,name,qty,weight_kg,price_cents) VALUES (?,?,?,?,?,?,?)')
      .run(id('itm'), oid, cat?.id ?? null, cat?.name || 'Wash & Fold', 1, 4, 1400);
    if (driver) {
      const start = { lat: addr.lat + 0.025, lng: addr.lng + 0.02 }; // ~3km away
      db.prepare('INSERT INTO driver_locations (id,driver_id,order_id,lat,lng,ts) VALUES (?,?,?,?,?,?)')
        .run(id('loc'), driver.id, oid, start.lat, start.lng, now());
    }
    const full = fullOrder(oid);
    io.to('role:ops').emit('order:new', full);
    res.json(full);
  });
}

// ---- pricing engine ----
function lineTotal(cat, it) {
  // explicit per-unit price override (e.g. B2B contract pricing set at runtime)
  if (it.unit_cents != null && it.unit_cents !== '') {
    const per = Number(it.unit_cents) || 0;
    return it.weight_kg ? Math.round(per * it.weight_kg) : per * (it.qty || 1);
  }
  if (!cat) return it.price_cents || 0;
  if (cat.unit === 'per_kg') return Math.round(cat.price_cents * (it.weight_kg || 0));
  return cat.price_cents * (it.qty || 1);
}

function priceOrder({ customer_id, items = [], use_credit = false, b2b = false }) {
  let subtotal = 0;
  for (const it of items) {
    const cat = db.prepare('SELECT * FROM catalog WHERE id = ?').get(it.catalog_id);
    subtotal += lineTotal(cat, it);
  }
  // B2B = contract billing: items only, no consumer platform fee / delivery / plan discount / wallet
  if (b2b) {
    return { subtotal_cents: subtotal, platform_fee_cents: 0, delivery_fee_cents: 0, discount_cents: 0, credit_applied_cents: 0, total_cents: subtotal, plan: 'B2B' };
  }
  const sub = customer_id ? activeSub(customer_id) : null;
  // Chase Plus/Pro waive the flat service fee (no more % discount) + get free delivery
  const serviceFee = sub ? 0 : SERVICE_FEE_CENTS;
  const delivery = sub && sub.free_delivery ? 0 : 250;
  let total = subtotal + serviceFee + delivery;
  let creditApplied = 0;
  if (use_credit && customer_id) {
    const bal = balanceOf(customer_id);
    creditApplied = Math.min(bal, Math.max(0, total));
    total -= creditApplied;
  }
  return {
    subtotal_cents: subtotal,
    platform_fee_cents: serviceFee,
    delivery_fee_cents: delivery,
    discount_cents: 0,
    credit_applied_cents: creditApplied,
    total_cents: Math.max(0, total),
    plan: sub ? sub.plan_name : 'Lite',
  };
}

function addMessage(io, threadId, sender_role, sender_id, body) {
  const msg = { id: `msg_${nanoid(8)}`, thread_id: threadId, sender_role, sender_id, body, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO support_messages (id,thread_id,sender_role,sender_id,body,created_at) VALUES (?,?,?,?,?,?)')
    .run(msg.id, threadId, sender_role, sender_id, body, msg.created_at);
  db.prepare('UPDATE support_threads SET updated_at = ? WHERE id = ?').run(msg.created_at, threadId);
  const thread = db.prepare('SELECT * FROM support_threads WHERE id = ?').get(threadId);
  io.to(`thread:${threadId}`).emit('support:message', msg);
  // notify the other side
  if (thread) {
    if (sender_id === thread.customer_id) {
      io.to('role:ops').emit('support:message', { ...msg, customer_id: thread.customer_id });
    } else {
      io.to(`user:${thread.customer_id}`).emit('support:message', msg);
      notify({ io, userId: thread.customer_id, type: 'support', title: 'New reply from support', body: body.slice(0, 80) });
    }
  }
  return msg;
}
