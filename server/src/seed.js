import { db, initSchema, GARMENT_FLOW } from './db.js';
import { nanoid } from 'nanoid';
import { hashPassword } from './crypto.js';

initSchema();

// wipe (POC: clean slate each seed)
const tables = ['reviews', 'referrals', 'credits', 'support_messages', 'support_threads',
  'notifications', 'driver_locations', 'shifts', 'transfers', 'garment_events', 'garments', 'order_items', 'orders',
  'subscriptions', 'plans', 'catalog', 'addresses', 'facilities', 'users'];
db.exec('PRAGMA foreign_keys = OFF');
for (const t of tables) db.exec(`DELETE FROM ${t}`);
db.exec('PRAGMA foreign_keys = ON');

const now = () => new Date().toISOString();
const hoursFromNow = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const id = (p) => `${p}_${nanoid(8)}`;

// ---- facilities (warehouses) ----
const WH = {
  central: { id: 'wh_central', code: 'WH-C', name: 'Central Hub', line1: '1 Kim Seng Promenade', area: 'Central', postcode: '237994', lat: 1.2903, lng: 103.8300, phone: '+65 6000 1001', capacity_kg: 800 },
  east: { id: 'wh_east', code: 'WH-E', name: 'East Hub', line1: '10 Tampines Industrial Ave 5', area: 'Tampines', postcode: '528605', lat: 1.3724, lng: 103.9430, phone: '+65 6000 1002', capacity_kg: 600 },
  west: { id: 'wh_west', code: 'WH-W', name: 'West Hub', line1: '15 Jurong Port Road', area: 'Jurong', postcode: '619092', lat: 1.3160, lng: 103.7220, phone: '+65 6000 1003', capacity_kg: 700 },
};
const insFac = db.prepare('INSERT INTO facilities (id,code,name,line1,area,postcode,lat,lng,phone,capacity_kg,active) VALUES (@id,@code,@name,@line1,@area,@postcode,@lat,@lng,@phone,@capacity_kg,1)');
for (const f of Object.values(WH)) insFac.run(f);

// ---- users ----
// ops: one HQ console (sees all) + one manager per warehouse (scoped)
const hq = { id: 'ops_hq', role: 'ops', name: 'HQ Console', email: 'hq@chaselaundry.com', phone: '+65 6000 0000', avatar: 'HQ', facility_id: null };
const opsCentral = { id: 'ops_central', role: 'ops', name: 'Central Hub — Ops', email: 'central@chaselaundry.com', phone: '+65 6000 1001', avatar: 'WC', facility_id: WH.central.id };
const opsEast = { id: 'ops_east', role: 'ops', name: 'East Hub — Ops', email: 'east@chaselaundry.com', phone: '+65 6000 1002', avatar: 'WE', facility_id: WH.east.id };
const opsWest = { id: 'ops_west', role: 'ops', name: 'West Hub — Ops', email: 'west@chaselaundry.com', phone: '+65 6000 1003', avatar: 'WW', facility_id: WH.west.id };
const ops = hq; // back-compat reference used elsewhere in seed
const driver1 = { id: 'drv_1', role: 'driver', name: 'Marcus Tan', email: 'marcus@chaselaundry.com', phone: '+65 8100 1111', avatar: 'MT', facility_id: null };
const driver2 = { id: 'drv_2', role: 'driver', name: 'Priya Nair', email: 'priya@chaselaundry.com', phone: '+65 8100 2222', avatar: 'PN', facility_id: null };
const cust1 = { id: 'cus_1', role: 'customer', name: 'Alex Morgan', email: 'alex@example.com', phone: '+65 9100 3333', avatar: 'AM', facility_id: null };
const cust2 = { id: 'cus_2', role: 'customer', name: 'Jordan Lee', email: 'jordan@example.com', phone: '+65 9100 4444', avatar: 'JL', facility_id: null };

const insUser = db.prepare('INSERT INTO users (id,role,name,email,phone,avatar,facility_id,created_at) VALUES (@id,@role,@name,@email,@phone,@avatar,@facility_id,@created_at)');
for (const u of [hq, opsCentral, opsEast, opsWest, driver1, driver2, cust1, cust2]) insUser.run({ ...u, created_at: now() });

// demo customers can sign in with password "password"
const setPw = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
for (const c of [cust1, cust2]) setPw.run(hashPassword('password'), c.id);

// ---- addresses ----
const insAddr = db.prepare('INSERT INTO addresses (id,user_id,label,line1,line2,city,postcode,lat,lng,is_default) VALUES (@id,@user_id,@label,@line1,@line2,@city,@postcode,@lat,@lng,@is_default)');
const addr1 = id('adr');
insAddr.run({ id: addr1, user_id: cust1.id, label: 'Home', line1: '78 Tiong Bahru Road', line2: '#12-04', city: 'Singapore', postcode: '168732', lat: 1.2847, lng: 103.8270, is_default: 1 });
const addr2 = id('adr');
insAddr.run({ id: addr2, user_id: cust2.id, label: 'Home', line1: '15 Tanjong Pagar Road', line2: '#08-11', city: 'Singapore', postcode: '088326', lat: 1.2766, lng: 103.8455, is_default: 1 });

// ---- catalog ----
const catalog = [
  { name: 'Wash & Fold', category: 'wash_fold', unit: 'per_kg', price_cents: 350, icon: '🧺', eta_hours: 24 },
  { name: 'Wash & Iron', category: 'wash_fold', unit: 'per_kg', price_cents: 550, icon: '👕', eta_hours: 24 },
  { name: 'Shirt — Dry Clean', category: 'dry_clean', unit: 'per_item', price_cents: 450, icon: '👔', eta_hours: 48 },
  { name: 'Suit (2pc) — Dry Clean', category: 'dry_clean', unit: 'per_item', price_cents: 1600, icon: '🕴️', eta_hours: 48 },
  { name: 'Dress — Dry Clean', category: 'dry_clean', unit: 'per_item', price_cents: 1200, icon: '👗', eta_hours: 48 },
  { name: 'Duvet (Double)', category: 'bedding', unit: 'per_item', price_cents: 1800, icon: '🛏️', eta_hours: 72 },
  { name: 'Ironing Only', category: 'ironing', unit: 'per_item', price_cents: 250, icon: '🔥', eta_hours: 24 },
  { name: 'Trainers — Deep Clean', category: 'specialty', unit: 'per_item', price_cents: 1500, icon: '👟', eta_hours: 72 },
];
const insCat = db.prepare('INSERT INTO catalog (id,name,category,unit,price_cents,icon,eta_hours) VALUES (@id,@name,@category,@unit,@price_cents,@icon,@eta_hours)');
const catIds = {};
for (const c of catalog) { const cid = id('cat'); catIds[c.name] = cid; insCat.run({ id: cid, ...c }); }

// ---- plans ----
const plans = [
  { id: 'plan_lite', name: 'Lite', price_cents: 0, included_kg: 0, discount_pct: 0, free_delivery: 0, perks: JSON.stringify(['Pay as you go', 'Standard 24h turnaround']) },
  { id: 'plan_plus', name: 'Plus', price_cents: 1900, included_kg: 6, discount_pct: 10, free_delivery: 1, perks: JSON.stringify(['6kg wash & fold / mo', '10% off everything', 'Free delivery', 'Priority slots']) },
  { id: 'plan_pro', name: 'Pro', price_cents: 3900, included_kg: 15, discount_pct: 20, free_delivery: 1, perks: JSON.stringify(['15kg wash & fold / mo', '20% off everything', 'Free delivery', 'Same-day available', 'Dedicated support']) },
];
const insPlan = db.prepare('INSERT INTO plans (id,name,price_cents,included_kg,discount_pct,free_delivery,perks) VALUES (@id,@name,@price_cents,@included_kg,@discount_pct,@free_delivery,@perks)');
for (const p of plans) insPlan.run(p);

// cust1 is on Plus
db.prepare('INSERT INTO subscriptions (id,user_id,plan_id,status,started_at,renews_at) VALUES (?,?,?,?,?,?)')
  .run(id('sub'), cust1.id, 'plan_plus', 'active', new Date(Date.now() - 20 * 864e5).toISOString(), hoursFromNow(24 * 10));

// ---- wallet / credits ----
const insCredit = db.prepare('INSERT INTO credits (id,user_id,amount_cents,type,reason,order_id,created_at) VALUES (@id,@user_id,@amount_cents,@type,@reason,@order_id,@created_at)');
insCredit.run({ id: id('cr'), user_id: cust1.id, amount_cents: 1000, type: 'signup', reason: 'Welcome credit', order_id: null, created_at: now() });
insCredit.run({ id: id('cr'), user_id: cust1.id, amount_cents: 500, type: 'referral', reason: 'Referral reward — Jordan joined', order_id: null, created_at: now() });
insCredit.run({ id: id('cr'), user_id: cust1.id, amount_cents: 300, type: 'in_store', reason: 'Goodwill credit for late delivery', order_id: null, created_at: now() });

// ---- referrals ----
db.prepare('INSERT INTO referrals (id,referrer_id,code,referee_email,status,reward_cents,created_at) VALUES (?,?,?,?,?,?,?)')
  .run(id('ref'), cust1.id, 'ALEX-CHASE', 'jordan@example.com', 'rewarded', 500, now());

// ---- orders ----
const insOrder = db.prepare(`INSERT INTO orders
  (id,code,customer_id,address_id,driver_id,facility_id,status,pickup_slot,return_slot,notes,
   subtotal_cents,platform_fee_cents,delivery_fee_cents,discount_cents,credit_applied_cents,total_cents,payment_status,created_at,updated_at)
  VALUES (@id,@code,@customer_id,@address_id,@driver_id,@facility_id,@status,@pickup_slot,@return_slot,@notes,
   @subtotal_cents,@platform_fee_cents,@delivery_fee_cents,@discount_cents,@credit_applied_cents,@total_cents,@payment_status,@created_at,@updated_at)`);
const insItem = db.prepare('INSERT INTO order_items (id,order_id,catalog_id,name,qty,weight_kg,price_cents) VALUES (@id,@order_id,@catalog_id,@name,@qty,@weight_kg,@price_cents)');
const insGarment = db.prepare('INSERT INTO garments (id,order_id,tag_code,type,color,weight_kg,care,status,notes,updated_at) VALUES (@id,@order_id,@tag_code,@type,@color,@weight_kg,@care,@status,@notes,@updated_at)');
const insEvent = db.prepare('INSERT INTO garment_events (id,garment_id,status,actor,note,ts) VALUES (?,?,?,?,?,?)');
// log the journey from checked_in up to the garment's current stage
function seedJourney(garmentId, currentStatus) {
  const upto = GARMENT_FLOW.indexOf(currentStatus);
  for (let i = 0; i <= upto; i++) {
    const ts = new Date(Date.now() - (upto - i) * 25 * 60e3).toISOString();
    insEvent.run(id('ev'), garmentId, GARMENT_FLOW[i], 'ops', i === 0 ? 'Checked in & tagged' : null, ts);
  }
}

let orderSeq = 1042;
function makeOrder({ customer, address, driver, facility, status, items, garments, paid, platformFee = 99, deliveryFee = 0, discount = 0, credit = 0 }) {
  const oid = id('ord');
  const subtotal = items.reduce((s, it) => s + it.price_cents, 0);
  const total = subtotal + platformFee + deliveryFee - discount - credit;
  insOrder.run({
    id: oid, code: `CL-${orderSeq++}`, customer_id: customer.id, address_id: address,
    driver_id: driver ? driver.id : null, facility_id: facility ? facility.id : null, status,
    pickup_slot: 'Today · 18:00–20:00', return_slot: 'Thu · 18:00–20:00', notes: '',
    subtotal_cents: subtotal, platform_fee_cents: platformFee, delivery_fee_cents: deliveryFee,
    discount_cents: discount, credit_applied_cents: credit, total_cents: total,
    payment_status: paid ? 'paid' : 'pending', created_at: now(), updated_at: now(),
  });
  for (const it of items) insItem.run({ id: id('itm'), order_id: oid, catalog_id: it.catalog_id || null, name: it.name, qty: it.qty || 1, weight_kg: it.weight_kg || null, price_cents: it.price_cents });
  let g = 1;
  for (const ga of (garments || [])) {
    const gid = id('grm');
    insGarment.run({ id: gid, order_id: oid, tag_code: `${`CL-${orderSeq - 1}`}-${String(g++).padStart(2, '0')}`, type: ga.type, color: ga.color, weight_kg: ga.weight_kg || null, care: ga.care || null, status: ga.status, notes: ga.notes || '', updated_at: now() });
    seedJourney(gid, ga.status);
  }
  return oid;
}

// Order in progress at facility (rich garment tracking)
makeOrder({
  customer: cust1, address: addr1, driver: driver1, facility: WH.central, status: 'processing', paid: true,
  platformFee: 99, deliveryFee: 0, discount: 90, credit: 300,
  items: [
    { catalog_id: catIds['Wash & Iron'], name: 'Wash & Iron', weight_kg: 4.2, price_cents: 2310 },
    { catalog_id: catIds['Shirt — Dry Clean'], name: 'Shirt — Dry Clean', qty: 2, price_cents: 900 },
  ],
  garments: [
    { type: 'Oxford shirt', color: 'White', status: 'ironing', care: 'Warm iron · light starch', weight_kg: 0.3 },
    { type: 'Oxford shirt', color: 'Blue', status: 'ironing', care: 'Warm iron · light starch', weight_kg: 0.3 },
    { type: 'Chinos', color: 'Navy', status: 'drying', care: 'Tumble low', weight_kg: 0.6 },
    { type: 'T-shirt', color: 'Grey', status: 'washing', care: '30° gentle wash', weight_kg: 0.2 },
    { type: 'Bedsheet', color: 'White', status: 'qc', care: 'Hot wash · press', weight_kg: 1.1 },
  ],
});

// Active delivery (driver en route) — used for live tracking demo
makeOrder({
  customer: cust1, address: addr1, driver: driver1, facility: WH.central, status: 'driver_en_route', paid: false,
  platformFee: 99, deliveryFee: 0,
  items: [{ catalog_id: catIds['Wash & Fold'], name: 'Wash & Fold', weight_kg: 5.5, price_cents: 1925 }],
  garments: [],
});

// Fresh unassigned order (ops needs to assign a driver)
makeOrder({
  customer: cust2, address: addr2, driver: null, status: 'placed', paid: false,
  platformFee: 99, deliveryFee: 250,
  items: [
    { catalog_id: catIds['Suit (2pc) — Dry Clean'], name: 'Suit (2pc) — Dry Clean', qty: 1, price_cents: 1600 },
    { catalog_id: catIds['Duvet (Double)'], name: 'Duvet (Double)', qty: 1, price_cents: 1800 },
  ],
  garments: [],
});

// A completed past order (history + review)
const pastOrder = makeOrder({
  customer: cust1, address: addr1, driver: driver2, facility: WH.east, status: 'completed', paid: true,
  platformFee: 99,
  items: [{ catalog_id: catIds['Wash & Fold'], name: 'Wash & Fold', weight_kg: 3.0, price_cents: 1050 }],
  garments: [],
});
db.prepare('INSERT INTO reviews (id,order_id,customer_id,driver_id,rating,comment,google_linked,created_at) VALUES (?,?,?,?,?,?,?,?)')
  .run(id('rev'), pastOrder, cust1.id, driver2.id, 5, 'Spotless and right on time.', 1, now());

// ---- driver shift (active) + a location ping ----
db.prepare('INSERT INTO shifts (id,driver_id,clock_in,clock_out,start_lat,start_lng,status) VALUES (?,?,?,?,?,?,?)')
  .run(id('shf'), driver1.id, new Date(Date.now() - 2 * 3600e3).toISOString(), null, 1.2931, 103.8520, 'active');
db.prepare('INSERT INTO driver_locations (id,driver_id,order_id,lat,lng,ts) VALUES (?,?,?,?,?,?)')
  .run(id('loc'), driver1.id, null, 1.2931, 103.8520, now());

// ---- notifications ----
const insNotif = db.prepare('INSERT INTO notifications (id,user_id,type,title,body,channel,order_id,read,created_at) VALUES (@id,@user_id,@type,@title,@body,@channel,@order_id,@read,@created_at)');
insNotif.run({ id: id('ntf'), user_id: cust1.id, type: 'order', title: 'Your laundry steaming already!', body: 'Order CL-1042 in our facility now. Sit back and relax ah.', channel: 'inapp', order_id: null, read: 0, created_at: now() });
insNotif.run({ id: id('ntf'), user_id: cust1.id, type: 'promo', title: 'S$5 referral credit added', body: 'Jordan joined with your code. Enjoy S$5 off.', channel: 'inapp', order_id: null, read: 1, created_at: now() });

// ---- support thread ----
const threadId = id('thr');
db.prepare('INSERT INTO support_threads (id,customer_id,subject,status,order_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
  .run(threadId, cust1.id, 'Question about my duvet', 'open', null, now(), now());
const insMsg = db.prepare('INSERT INTO support_messages (id,thread_id,sender_role,sender_id,body,created_at) VALUES (@id,@thread_id,@sender_role,@sender_id,@body,@created_at)');
insMsg.run({ id: id('msg'), thread_id: threadId, sender_role: 'customer', sender_id: cust1.id, body: 'Hi! Can help me steam-press my duvet cover also?', created_at: now() });
insMsg.run({ id: id('msg'), thread_id: threadId, sender_role: 'ops', sender_id: ops.id, body: 'Can can! Added a press to your order, no charge one. 👍', created_at: now() });

// ---- facility pricing ----
const insFacPricing = db.prepare('INSERT INTO facility_pricing (facility_id, catalog_id, cost_cents) VALUES (?, ?, ?)');
const whPricing = {
  [WH.central.id]: {
    'Wash & Fold': 220,
    'Wash & Iron': 360,
    'Shirt — Dry Clean': 300,
    'Suit (2pc) — Dry Clean': 1100,
    'Dress — Dry Clean': 800,
    'Duvet (Double)': 1250,
    'Ironing Only': 160,
    'Trainers — Deep Clean': 1000,
  },
  [WH.east.id]: {
    'Wash & Fold': 250,
    'Wash & Iron': 380,
    'Shirt — Dry Clean': 320,
    'Suit (2pc) — Dry Clean': 1200,
    'Dress — Dry Clean': 850,
    'Duvet (Double)': 1350,
    'Ironing Only': 180,
    'Trainers — Deep Clean': 1100,
  },
  [WH.west.id]: {
    'Wash & Fold': 200,
    'Wash & Iron': 340,
    'Shirt — Dry Clean': 280,
    'Suit (2pc) — Dry Clean': 1000,
    'Dress — Dry Clean': 750,
    'Duvet (Double)': 1200,
    'Ironing Only': 150,
    'Trainers — Deep Clean': 950,
  },
};

for (const [facId, pricing] of Object.entries(whPricing)) {
  for (const [itemName, cost] of Object.entries(pricing)) {
    insFacPricing.run(facId, catIds[itemName], cost);
  }
}

console.log('✅ Seeded ChaseLaundry POC database.');
console.log('   Customers:  cus_1 (Alex, on Plus), cus_2 (Jordan)');
console.log('   Drivers:    drv_1 (Marcus, on shift), drv_2 (Priya)');
console.log('   Warehouses: Central Hub, East Hub, West Hub');
console.log('   Ops:        ops_hq (HQ), ops_central, ops_east, ops_west');
db.close();
