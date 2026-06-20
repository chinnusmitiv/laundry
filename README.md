# ChaseLaundry — POC

> **More Life. Less Laundry.** — a doorstep laundry platform POC.

Four separate, on-brand surfaces sharing **one backend** in real time:

| App | Who | Port | What it does |
|-----|-----|------|--------------|
| **Website** | public + customers | `5176` | Marketing site (hero, how-it-works, services, pricing, reviews) **+ full online ordering, account, live tracking & garment journey, wallet, subscriptions, support** |
| **Customer** | end users (mobile) | `5173` | Order, live tracking, **per-garment tag + journey**, support chat, wallet/credit, referrals, subscriptions |
| **Driver** | field staff (mobile) | `5174` | Clock in/out, GPS tracking, job pipeline, QR Google-review, customer details |
| **Ops** | back office (desktop) | `5175` | Dashboard, order assignment, **garment tagging + scan station + printable QR labels**, drivers, support inbox |
| **Server** | API + realtime | `4000` | Express + `node:sqlite` + Socket.IO |

### Singapore + Singlish
The platform is localised for Singapore: currency in **S$**, `+65` phones, SG addresses/postcodes. Customer-facing copy (app + website) is written in a light **Singlish** voice.

**OneMap (Singapore Land Authority) is wired in for real:**
- **Address search** — `/api/places/search` proxies OneMap's address API (`server/src/places.js`), so every address field autocompletes against *every* real SG building and postal code (e.g. "Changi Airport", "049315", "Tiong Bahru"). Falls back to a built-in dataset if OneMap is unreachable. Set `ONEMAP_TOKEN` env to send an API token.
- **Live map** — the `<OneMap>` component (shared, Leaflet + OneMap raster tiles) renders a real Singapore map with a destination pin and a pulsing live driver marker. Used in the customer app, the website tracking view, and the Ops fleet dashboard.

### Multiple warehouses (facilities)
Laundry is processed across several warehouses. A **`facilities`** table holds each warehouse (code, OneMap address, capacity); orders carry a **`facility_id`**.
- **Routing is manual**: HQ assigns each order to a warehouse from the Orders board (a "Route…" dropdown), the same way drivers are assigned. Unrouted orders are flagged on the HQ dashboard.
- **Per-warehouse access**: the Ops app opens on a **console picker** — log in as **HQ** (sees all warehouses, routes orders, manages drivers + support) or as a **specific warehouse** (sees only orders routed to it; its own dashboard, orders, facility board & scan station). All warehouses are general-purpose. "Switch console" in the sidebar changes scope.
- **Driver** sees the assigned **drop-off warehouse** (name + address + Navigate) on each job. **Customers** see "Processed at <warehouse>" in tracking.
- Scoping is enforced server-side via `?facility_id=` on the ops endpoints.
- **Inter-warehouse transfers**: from an order's drawer, HQ or a warehouse can **send an order to another hub** (with a reason, e.g. specialist cleaning). The order goes `in_transit` and stays counted at the source until the **destination confirms receipt** (an "in transit" panel on the Facility board), at which point it moves over. Customers see "🚚 Moving to our <hub> for specialist care" while in transit. Tracked in a `transfers` table.

### Garment tagging system (across backend + ops + app + web)
At intake, Ops checks each garment in with a **weight + care note** and gets a unique **QR tag** (`CL-1042-01`) — printable from the Facility view. Every stage transition (`checked_in → washing → drying → ironing → qc → packed → returned`) is logged to a journey history. Ops can **scan a tag** at the Scan Station to auto-advance it. Customers see each item's tag, care note, and **live journey timeline** in both the mobile app and the website.

Everything external is **mocked** (Stripe, email, push, Google reviews, maps) — no API keys needed. Mock side-effects are logged to the server console so you can see when a charge/email/push *would* have fired.

## Run it

```bash
npm install      # installs all workspaces
npm run seed     # creates + seeds the demo database
npm run dev      # starts server + all 3 apps together
```

Then open:
- Website → http://localhost:5176
- Customer app → http://localhost:5173
- Driver app → http://localhost:5174
- Ops console → http://localhost:5175

> Run apps individually with `npm run dev:server` / `dev:customer` / `dev:driver` / `dev:ops` / `dev:web`.
> View the mobile apps in the iOS Simulator: `xcrun simctl openurl booted http://localhost:5173`.
> Re-run `npm run seed` any time to reset to a clean demo state.

## Demo script (5 minutes, shows all three apps connected live)

Open the three apps side by side.

1. **Customer** → *Schedule a pickup* → pick services, slot, review the price breakdown (Plus discount + wallet credit + platform fee all applied) → **Place order**.
2. **Ops → Orders**: the new order appears instantly. Assign **Marcus** as the driver.
3. **Driver** (logged in as Marcus): the job appears. Open it → *Start route* → tap **Send location update** a few times.
4. **Customer → order**: watch the driver move on the live map and the status timeline advance in real time.
5. **Ops → Facility**: as the order reaches the facility, move individual **garments** through Washing → Drying → Ironing → QC → Packed. The customer sees each item's stage.
6. **Driver**: *Mark delivered* → **Request Google review** → a scannable QR appears.
7. **Customer**: pay the order, rate it, then open **Support** and chat — replies from **Ops → Support** arrive live.
8. **Customer → Wallet**: invite a friend (referral), see credit ledger. **Account**: switch subscription plan.

## Seeded accounts (demo sessions are hard-coded per app)

- **Customer** = Alex Morgan (`cus_1`), on the **Plus** plan with wallet credit.
- **Driver** = Marcus Reid (`drv_1`), already on shift.
- **Ops** = single Ops Console (`ops_1`).

## Architecture

```
Laundry/
├── server/            Express + node:sqlite + Socket.IO
│   └── src/
│       ├── db.js          schema + status flows
│       ├── seed.js        demo data
│       ├── services.js    mocked Stripe / email / push / Google / geo
│       ├── routes.js      REST API (customer + driver + ops) + pricing engine
│       └── index.js       http + socket bootstrap
├── shared/            @shared — brand kit (logo, theme, UI components, api+socket client)
└── apps/
    ├── web/           React + Vite + React Router  (marketing site + full customer web app)
    ├── customer/      React + Vite  (mobile)
    ├── driver/        React + Vite  (mobile, QR via `qrcode`)
    └── ops/           React + Vite  (desktop console, QR labels + scan station)
```

**Real time:** the server emits Socket.IO events (`order:updated`, `driver:location`, `notification`,
`support:message`, `garment:updated`) to scoped rooms (`user:*`, `role:ops`, `order:*`, `thread:*`).
All three apps subscribe, so an action in one is reflected in the others without a refresh.

**Order lifecycle:** `placed → assigned → driver_en_route → picked_up → at_facility → processing → ready → out_for_delivery → delivered → completed`.

**Pricing engine** (`routes.js`): subtotal (per-kg / per-item) + flat platform fee + delivery
(free on a paid plan) − plan discount − applied wallet credit. Quote endpoint previews it before ordering.

## Notes / next steps (production)

- Swap mock `services.js` for real Stripe, an email provider (Resend/SES), web-push/FCM, the Google
  Business review link, and real map tiles + native background GPS.
- Add auth (the POC hard-codes one session id per app).
- `node:sqlite` is great for a POC; move to Postgres for production.
