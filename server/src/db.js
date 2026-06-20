import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'chaselaundry.db');
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

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
    category TEXT NOT NULL,        -- wash_fold | dry_clean | ironing | bedding | specialty
    unit TEXT NOT NULL,           -- per_kg | per_item
    price_cents INTEGER NOT NULL,
    icon TEXT,
    eta_hours INTEGER DEFAULT 24
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
  `);
}

// canonical order status flow (drives both UIs + validation)
export const STATUS_FLOW = [
  'placed',
  'assigned',
  'driver_en_route',
  'picked_up',
  'at_facility',
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
  processing: 'Cleaning in progress',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const GARMENT_FLOW = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];
