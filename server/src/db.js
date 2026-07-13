import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { hashPassword } from './crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets a host with an ephemeral filesystem (e.g. Render) point this at a mounted persistent disk.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'chaselaundry.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,            -- customer | driver | ops
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar TEXT,
    facility_id TEXT,             -- for ops staff: which warehouse they manage (NULL = HQ / all)
    created_at TEXT NOT NULL
  );

  -- processing warehouses (general-purpose)
  CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,           -- short code e.g. WH-C
    name TEXT NOT NULL,
    line1 TEXT, area TEXT, postcode TEXT,
    lat REAL, lng REAL,
    phone TEXT,
    capacity_kg INTEGER DEFAULT 500,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    label TEXT, line1 TEXT, line2 TEXT, city TEXT, postcode TEXT,
    lat REAL, lng REAL,
    is_default INTEGER DEFAULT 0
  );

  -- service catalog (what a customer can order)
  CREATE TABLE IF NOT EXISTS catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,        -- wash_fold | dry_clean | ironing | bedding | specialty | linens | towels
    unit TEXT NOT NULL,           -- per_kg | per_item | per_bag
    price_cents INTEGER NOT NULL,
    icon TEXT,
    eta_hours INTEGER DEFAULT 24,
    scope TEXT NOT NULL DEFAULT 'b2c',  -- b2c (consumer catalog) | b2b (corporate: linens/towels)
    grp TEXT                            -- garment sub-group for per-item pricelists (Shirts, Tops, Bottoms, Suits…)
  );

  -- per-client negotiated B2B rates — overrides the b2b catalog's default price_cents for a specific business
  CREATE TABLE IF NOT EXISTS business_rates (
    business_id TEXT NOT NULL REFERENCES users(id),
    catalog_id TEXT NOT NULL REFERENCES catalog(id),
    price_cents INTEGER NOT NULL,
    PRIMARY KEY (business_id, catalog_id)
  );

  -- subscription plans
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    included_kg INTEGER DEFAULT 0,
    discount_pct INTEGER DEFAULT 0,
    free_delivery INTEGER DEFAULT 0,
    perks TEXT                     -- JSON array
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    plan_id TEXT NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL,          -- active | paused | cancelled
    started_at TEXT,
    renews_at TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES users(id),
    address_id TEXT REFERENCES addresses(id),
    driver_id TEXT REFERENCES users(id),
    facility_id TEXT REFERENCES facilities(id),  -- which warehouse processes this order
    status TEXT NOT NULL,          -- see STATUS_FLOW
    pickup_slot TEXT,
    return_slot TEXT,
    notes TEXT,
    subtotal_cents INTEGER DEFAULT 0,
    platform_fee_cents INTEGER DEFAULT 0,
    delivery_fee_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    credit_applied_cents INTEGER DEFAULT 0,
    total_cents INTEGER DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',  -- pending | paid | refunded
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    catalog_id TEXT REFERENCES catalog(id),
    name TEXT, qty INTEGER DEFAULT 1, weight_kg REAL,
    price_cents INTEGER DEFAULT 0
  );

  -- individual garment tracking
  CREATE TABLE IF NOT EXISTS garments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    tag_code TEXT NOT NULL,
    type TEXT, color TEXT,
    weight_kg REAL,
    care TEXT,                     -- care instruction note
    status TEXT NOT NULL,          -- checked_in | washing | drying | ironing | qc | packed | returned
    notes TEXT,
    updated_at TEXT
  );

  -- inter-warehouse transfers: move an order from one hub to another
  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    from_facility_id TEXT REFERENCES facilities(id),
    to_facility_id TEXT NOT NULL REFERENCES facilities(id),
    reason TEXT,
    status TEXT NOT NULL,          -- in_transit | received | cancelled
    created_by TEXT,
    created_at TEXT NOT NULL,
    received_at TEXT
  );

  -- per-garment journey: every stage transition is logged here
  CREATE TABLE IF NOT EXISTS garment_events (
    id TEXT PRIMARY KEY,
    garment_id TEXT NOT NULL REFERENCES garments(id),
    status TEXT NOT NULL,
    actor TEXT,                    -- who/what moved it (e.g. 'ops', 'scan')
    note TEXT,
    ts TEXT NOT NULL
  );

  -- driver shifts (clock in / out)
  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES users(id),
    clock_in TEXT NOT NULL,
    clock_out TEXT,
    start_lat REAL, start_lng REAL,
    status TEXT NOT NULL           -- active | ended
  );

  -- live driver gps pings
  CREATE TABLE IF NOT EXISTS driver_locations (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES users(id),
    order_id TEXT REFERENCES orders(id),
    lat REAL, lng REAL,
    ts TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT,
    title TEXT, body TEXT,
    channel TEXT,                  -- inapp | email | push
    order_id TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_threads (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES users(id),
    subject TEXT,
    status TEXT DEFAULT 'open',    -- open | resolved
    order_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES support_threads(id),
    sender_role TEXT NOT NULL,     -- customer | ops | system
    sender_id TEXT,
    body TEXT,
    created_at TEXT NOT NULL
  );

  -- wallet ledger: referral + in-store credit + refunds + spend
  CREATE TABLE IF NOT EXISTS credits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL, -- positive = credit, negative = spend
    type TEXT NOT NULL,            -- referral | in_store | refund | signup | spend | adjustment
    reason TEXT,
    order_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    referee_email TEXT,
    status TEXT DEFAULT 'sent',    -- sent | joined | rewarded
    reward_cents INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id),
    customer_id TEXT REFERENCES users(id),
    driver_id TEXT REFERENCES users(id),
    rating INTEGER,
    comment TEXT,
    google_linked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS facility_pricing (
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    catalog_id TEXT NOT NULL REFERENCES catalog(id),
    cost_cents INTEGER NOT NULL,
    PRIMARY KEY (facility_id, catalog_id)
  );

  -- consolidated B2B invoices (monthly statements): one invoice bills a business
  -- client for many completed orders. Orders link back via orders.invoice_id.
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,                         -- e.g. INV-2026-0007
    business_id TEXT NOT NULL REFERENCES users(id),
    period TEXT,                                -- YYYY-MM (statement month), or null for ad-hoc
    status TEXT NOT NULL DEFAULT 'draft',       -- draft | sent | paid | void
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,       -- GST
    total_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    issued_at TEXT NOT NULL,
    due_at TEXT,
    sent_at TEXT,
    paid_at TEXT
  );

  -- factory (facility) cash withdrawals: a facility requests a payout of its earned
  -- balance to its bank account; HQ settles it (mock bank transfer).
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',  -- requested | paid | rejected
    bank_account TEXT,
    note TEXT,
    requested_at TEXT NOT NULL,
    settled_at TEXT
  );

  -- key/value app settings (JSON), e.g. order routing config
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- prepaid quantity packs (e.g. "30kg Wash & Fold pack") — separate from the dollar-credit wallet.
  -- customer buys a fixed kg/item quantity at a discount; balance is drawn down as matching orders are placed.
  CREATE TABLE IF NOT EXISTS packs (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES users(id),
    catalog_id TEXT NOT NULL REFERENCES catalog(id),
    unit TEXT NOT NULL,             -- per_kg | per_item, mirrors catalog.unit at purchase time
    quantity_total REAL NOT NULL,
    quantity_used REAL NOT NULL DEFAULT 0,
    price_cents INTEGER NOT NULL,
    purchased_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  `);

  migrateAuth();
  migrateOrders();
  migrateRepeatOrders();
  migrateLoadWash();
  migrateB2B();
  seedOpsAdminIfMissing();
}

// Ensure a default ops admin login exists, without touching any other data
// (safe to run against a live/production DB that was never through seed.js).
function seedOpsAdminIfMissing() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'ops_admin'`).get();
  if (row) return;
  db.prepare(`INSERT INTO settings (key, value) VALUES ('ops_admin', ?)`)
    .run(JSON.stringify({ username: 'admin', password_hash: hashPassword('chaselaundry') }));
}

// Add repeat-order preference to orders (idempotent).
function migrateRepeatOrders() {
  const cols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
  if (!cols.includes('repeat_requested')) db.exec('ALTER TABLE orders ADD COLUMN repeat_requested INTEGER DEFAULT 0');
  if (!cols.includes('repeat_cadence')) db.exec('ALTER TABLE orders ADD COLUMN repeat_cadence TEXT'); // weekly | biweekly | monthly
}

// Load wash (per_kg lines): the facility's actual weighed total, distinct from the customer's estimate (idempotent).
function migrateLoadWash() {
  const cols = db.prepare('PRAGMA table_info(order_items)').all().map((c) => c.name);
  if (!cols.includes('actual_weight_kg')) db.exec('ALTER TABLE order_items ADD COLUMN actual_weight_kg REAL');
}

// B2B catalog scope + by-the-bag reconciliation (idempotent).
function migrateB2B() {
  const catCols = db.prepare('PRAGMA table_info(catalog)').all().map((c) => c.name);
  if (!catCols.includes('scope')) db.exec("ALTER TABLE catalog ADD COLUMN scope TEXT NOT NULL DEFAULT 'b2c'");
  if (!catCols.includes('grp')) db.exec('ALTER TABLE catalog ADD COLUMN grp TEXT');
  // facility bank account for cash withdrawals (mock)
  const facCols = db.prepare('PRAGMA table_info(facilities)').all().map((c) => c.name);
  if (!facCols.includes('bank_account')) db.exec('ALTER TABLE facilities ADD COLUMN bank_account TEXT');
  // B2B client invoicing (ChaseLaundry → business): invoice lifecycle on the order
  const oCols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
  if (!oCols.includes('invoice_status')) db.exec('ALTER TABLE orders ADD COLUMN invoice_status TEXT'); // unbilled | billed | sent | paid
  if (!oCols.includes('invoiced_at')) db.exec('ALTER TABLE orders ADD COLUMN invoiced_at TEXT');
  if (!oCols.includes('invoice_paid_at')) db.exec('ALTER TABLE orders ADD COLUMN invoice_paid_at TEXT');
  if (!oCols.includes('invoice_id')) db.exec('ALTER TABLE orders ADD COLUMN invoice_id TEXT'); // FK to a consolidated invoice
  if (!oCols.includes('intake_confirmed_at')) db.exec('ALTER TABLE orders ADD COLUMN intake_confirmed_at TEXT'); // factory verified & locked the billable amount
  const itemCols = db.prepare('PRAGMA table_info(order_items)').all().map((c) => c.name);
  if (!itemCols.includes('actual_qty')) db.exec('ALTER TABLE order_items ADD COLUMN actual_qty INTEGER');       // qty the factory actually received (per_item)
  if (!itemCols.includes('actual_weight_kg')) db.exec('ALTER TABLE order_items ADD COLUMN actual_weight_kg REAL'); // weight the factory re-weighed (per_kg)
}

// Add pickup handover instructions to orders (idempotent).
function migrateOrders() {
  const cols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
  if (!cols.includes('handover')) db.exec('ALTER TABLE orders ADD COLUMN handover TEXT');           // hand_to_me | leave_at_door | someone_else
  if (!cols.includes('handover_contact')) db.exec('ALTER TABLE orders ADD COLUMN handover_contact TEXT'); // name/phone when someone_else
  if (!cols.includes('tip_cents')) db.exec('ALTER TABLE orders ADD COLUMN tip_cents INTEGER DEFAULT 0'); // driver tip, chosen at checkout
  if (!cols.includes('pack_credit_cents')) db.exec('ALTER TABLE orders ADD COLUMN pack_credit_cents INTEGER DEFAULT 0'); // value covered by a prepaid pack
  // authorize-now / capture-on-delivery: hold the card at checkout, charge on success
  if (!cols.includes('payment_auth_id')) db.exec('ALTER TABLE orders ADD COLUMN payment_auth_id TEXT');            // Stripe PaymentIntent id of the hold
  if (!cols.includes('hold_amount_cents')) db.exec('ALTER TABLE orders ADD COLUMN hold_amount_cents INTEGER');     // amount held on the card
  if (!cols.includes('authorized_at')) db.exec('ALTER TABLE orders ADD COLUMN authorized_at TEXT');
  if (!cols.includes('captured_at')) db.exec('ALTER TABLE orders ADD COLUMN captured_at TEXT');

  const acols = db.prepare('PRAGMA table_info(addresses)').all().map((c) => c.name);
  if (!acols.includes('type')) db.exec("ALTER TABLE addresses ADD COLUMN type TEXT DEFAULT 'home'"); // home | work | other
}

// Add password support to the users table (idempotent) and make sure existing
// demo customers can sign in. Default password for any pre-existing customer is
// "password" — handy for live demos with the seeded Alex Morgan account.
function migrateAuth() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  }
  // extra profile fields (used mainly for B2B clients on invoices)
  for (const col of ['address', 'contact_person', 'gst_no', 'payment_terms']) {
    if (!cols.includes(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
  }

  const orphans = db.prepare(
    `SELECT id FROM users WHERE role = 'customer' AND (password_hash IS NULL OR password_hash = '')`
  ).all();
  if (orphans.length) {
    const set = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    for (const u of orphans) set.run(hashPassword('password'), u.id);
  }
}

// canonical order status flow (drives both UIs + validation)
export const STATUS_FLOW = [
  'placed',
  'assigned',
  'driver_en_route',
  'picked_up',
  'at_facility',
  'confirmed',
  'processing',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
];

export const STATUS_LABEL = {
  placed: 'Order placed',
  assigned: 'Driver assigned',
  driver_en_route: 'Driver on the way',
  picked_up: 'Picked up',
  at_facility: 'At facility',
  confirmed: 'Items confirmed',
  processing: 'Cleaning in progress',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const GARMENT_FLOW = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];
