import { nanoid } from 'nanoid';
import { db, STATUS_FLOW, STATUS_LABEL, GARMENT_FLOW } from './db.js';
import { payments, google, notify, stepToward, distanceKm } from './services.js';
import { searchPlaces, searchOneMap } from './places.js';

const now = () => new Date().toISOString();
const id = (p) => `${p}_${nanoid(8)}`;
const PLATFORM_FEE = 99; // flat platform fee in cents

// ---- query helpers ----
const getUser = (uid) => db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
const balanceOf = (uid) =>
  db.prepare('SELECT COALESCE(SUM(amount_cents),0) b FROM credits WHERE user_id = ?').get(uid).b;
const activeSub = (uid) =>
  db.prepare(`SELECT s.*, p.name plan_name, p.discount_pct, p.free_delivery, p.included_kg, p.price_cents plan_price
              FROM subscriptions s JOIN plans p ON p.id = s.plan_id
              WHERE s.user_id = ? AND s.status = 'active'`).get(uid);

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
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(oid);
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
    res.json(rows);
  });
  app.get('/api/users/:id', (req, res) => res.json(getUser(req.params.id) || {}));
  app.get('/api/catalog', (_req, res) => res.json(db.prepare('SELECT * FROM catalog ORDER BY category, name').all()));

  // warehouses
  app.get('/api/facilities', (_req, res) => res.json(db.prepare('SELECT * FROM facilities WHERE active = 1 ORDER BY name').all()));

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
    const { label, line1, line2, city, postcode, lat, lng, make_default } = req.body;
    const aid = id('adr');
    if (make_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(uid);
    db.prepare('INSERT INTO addresses (id,user_id,label,line1,line2,city,postcode,lat,lng,is_default) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(aid, uid, label || 'New address', line1 ?? null, line2 ?? null, city || 'Singapore', postcode ?? null, lat ?? null, lng ?? null, make_default ? 1 : 0);
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

  // create order
  app.post('/api/orders', (req, res) => {
    const { customer_id, address_id, items = [], pickup_slot, return_slot, notes, use_credit } = req.body;
    const pricing = priceOrder({ customer_id, items, use_credit });
    const oid = id('ord');
    const code = `CL-${1000 + db.prepare('SELECT COUNT(*) c FROM orders').get().c + 50}`;
    db.prepare(`INSERT INTO orders (id,code,customer_id,address_id,driver_id,status,pickup_slot,return_slot,notes,
        subtotal_cents,platform_fee_cents,delivery_fee_cents,discount_cents,credit_applied_cents,total_cents,payment_status,created_at,updated_at)
      VALUES (?,?,?,?,NULL,'placed',?,?,?,?,?,?,?,?,?, 'pending', ?, ?)`)
      .run(oid, code, customer_id, address_id ?? null, pickup_slot ?? null, return_slot ?? null, notes || '',
        pricing.subtotal_cents, pricing.platform_fee_cents, pricing.delivery_fee_cents,
        pricing.discount_cents, pricing.credit_applied_cents, pricing.total_cents, now(), now());
    for (const it of items) {
      const cat = db.prepare('SELECT * FROM catalog WHERE id = ?').get(it.catalog_id);
      const line = lineTotal(cat, it);
      db.prepare('INSERT INTO order_items (id,order_id,catalog_id,name,qty,weight_kg,price_cents) VALUES (?,?,?,?,?,?,?)')
        .run(id('itm'), oid, it.catalog_id, cat?.name || it.name, it.qty || 1, it.weight_kg || null, line);
    }
    // spend credit
    if (pricing.credit_applied_cents > 0) {
      db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(id('cr'), customer_id, -pricing.credit_applied_cents, 'spend', `Applied to ${code}`, oid, now());
    }
    notify({ io, userId: customer_id, type: 'order', title: 'Order confirm liao 🎉', body: `${code} received! We assign a driver for you shortly, don't worry ah.`, orderId: oid });
    io.to('role:ops').emit('order:new', fullOrder(oid));
    res.json(fullOrder(oid));
  });

  app.post('/api/orders/:id/pay', (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    const pay = payments.charge({ orderId: o.id, amountCents: o.total_cents, customer: getUser(o.customer_id) });
    db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').run('paid', now(), o.id);
    notify({ io, userId: o.customer_id, type: 'payment', title: 'Payment received', body: `S$${(o.total_cents / 100).toFixed(2)} paid for ${o.code}.`, orderId: o.id });
    res.json({ ok: true, payment: pay, order: broadcastOrder(io, o.id) });
  });

  // wallet / credits
  app.get('/api/customers/:id/credits', (req, res) => {
    res.json({
      balance_cents: balanceOf(req.params.id),
      ledger: db.prepare('SELECT * FROM credits WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id),
    });
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
    res.json(drivers.map((d) => ({
      ...d,
      shift: db.prepare(`SELECT * FROM shifts WHERE driver_id=? AND status='active' LIMIT 1`).get(d.id) || null,
      active_jobs: db.prepare(`SELECT COUNT(*) c FROM orders WHERE driver_id=? AND status NOT IN ('completed','cancelled')`).get(d.id).c,
      location: db.prepare('SELECT * FROM driver_locations WHERE driver_id=? ORDER BY ts DESC LIMIT 1').get(d.id) || null,
    })));
  });

  app.post('/api/orders/:id/assign', (req, res) => {
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
              lineCost = Math.round(costPerUnit * (it.weight_kg || 0));
            } else {
              lineCost = costPerUnit * (it.qty || 1);
            }
          }
          orderCost += lineCost;
          itemsList.push({
            ...it,
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
}

// ---- pricing engine ----
function lineTotal(cat, it) {
  if (!cat) return it.price_cents || 0;
  if (cat.unit === 'per_kg') return Math.round(cat.price_cents * (it.weight_kg || 0));
  return cat.price_cents * (it.qty || 1);
}

function priceOrder({ customer_id, items = [], use_credit = false }) {
  let subtotal = 0;
  for (const it of items) {
    const cat = db.prepare('SELECT * FROM catalog WHERE id = ?').get(it.catalog_id);
    subtotal += lineTotal(cat, it);
  }
  const sub = customer_id ? activeSub(customer_id) : null;
  const discount = sub ? Math.round((subtotal * sub.discount_pct) / 100) : 0;
  const delivery = sub && sub.free_delivery ? 0 : 250;
  let total = subtotal + PLATFORM_FEE + delivery - discount;
  let creditApplied = 0;
  if (use_credit && customer_id) {
    const bal = balanceOf(customer_id);
    creditApplied = Math.min(bal, Math.max(0, total));
    total -= creditApplied;
  }
  return {
    subtotal_cents: subtotal,
    platform_fee_cents: PLATFORM_FEE,
    delivery_fee_cents: delivery,
    discount_cents: discount,
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
