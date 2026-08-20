# Utkal Laxmi — Backend

A real, standalone backend for the `utkal-laxmi-invoice-system` HTML app.

## Why you need this

The HTML file you gave me stores its data with `window.storage.get/set`. That
API **only exists inside Claude's Artifacts preview** — it will not work if
you upload the HTML file to a normal web host. This backend replaces it with
a real Node.js/Express API backed by SQLite (a single file on disk), so your
products, coupons and invoices persist for real, on your own server.

## What's included

```
utkal-laxmi-backend/
  server.js            # Express app entry point
  db.js                # SQLite schema (auto-created on first run)
  routes/
    kv.js               # Generic key-value API (drop-in replacement for window.storage)
    products.js          # Optional proper REST API for products
    coupons.js            # Optional proper REST API for coupons (+ validation endpoint)
    invoices.js           # Optional proper REST API for invoices (server-side numbering/totals)
  .env.example
  package.json
  frontend-integration.js  # paste this into the HTML in place of loadKey/saveKey
```

There are two ways to use this backend — pick one:

- **Option A (fastest, ~0 frontend changes):** use the `/api/kv/*` endpoints.
  They mirror `window.storage.get/set` exactly, so you only replace two
  small functions (`loadKey`/`saveKey`) in the HTML. See below.
- **Option B (cleaner, more work):** use `/api/products`, `/api/coupons`,
  `/api/invoices` — real REST resources with validation, coupon-checking and
  invoice-numbering done safely on the server instead of in the browser.
  Recommended if you plan to keep developing this app.

This package ships both so you can start with A and migrate to B later.

## 1. Install & run

Requires Node.js 18+.

```bash
cd utkal-laxmi-backend
npm install
cp .env.example .env      # edit CORS_ORIGIN / API_KEY as needed
npm start
```

The server starts on `http://localhost:4000` (or your `PORT`) and creates
`data/utkal-laxmi.db` automatically on first run — no separate database
server to install.

Health check: `GET http://localhost:4000/health`

## 2. Connect the existing HTML file (Option A)

In `utkal-laxmi-invoice-system-7.html`, find this block near the top of the
`<script>` tag:

```js
async function loadKey(key){
  try{
    const r = await window.storage.get(key, false);
    return r && r.value ? JSON.parse(r.value) : [];
  }catch(e){
    return [];
  }
}
async function saveKey(key, val){
  try{
    const r = await window.storage.set(key, JSON.stringify(val), false);
    if(!r) showToast("Could not save — please retry.");
  }catch(e){
    showToast("Storage error — changes may not be saved.");
  }
}
```

Replace it with the contents of `frontend-integration.js` (also shown
below). Everything else in the file — `renderApp`, `generateInvoice`,
`renderInvoiceDoc`, etc. — stays exactly the same, because it only ever
calls `loadKey('ul_products')`, `saveKey('ul_coupons', coupons)`, etc.

Nothing else in the HTML needs to change.

## 3. Security notes before you go live

- Set `API_KEY` in `.env` and add the matching `x-api-key` header in
  `frontend-integration.js` (there's a placeholder for it) — otherwise
  anyone who finds your server URL can read/overwrite your shop data.
- Set `CORS_ORIGIN` to your real domain, not `*`.
- Put this behind HTTPS (a reverse proxy like Caddy, Nginx, or a platform
  like Render/Railway/Fly.io that provisions TLS for you).
- Back up `data/utkal-laxmi.db` periodically (it's a single file — just copy
  it).
- The generic `/api/kv/*` endpoints will happily store any JSON blob under
  any key an attacker chooses to send, so `API_KEY` protection matters more
  for that option than for the resource-specific routes in Option B, which
  validate their input shape.

## 4. Deploying

Any Node host works (Render, Railway, Fly.io, a VPS with PM2, etc.). Steps
are the same everywhere:

1. Push this folder to a git repo (or upload it directly).
2. Set the environment variables from `.env.example` in your host's
   dashboard.
3. Start command: `npm start`.
4. Point `API_BASE_URL` in the frontend (see `frontend-integration.js`) at
   your deployed URL, e.g. `https://api.utkallaxmi.com`.
5. Make sure `data/` is on **persistent** storage — some platforms wipe the
   filesystem on redeploy, which would delete your SQLite database. If your
   host doesn't offer persistent disks, swap in a hosted Postgres/MySQL
   instead (ask me and I'll adapt `db.js`).

## 5. Option B — using the real REST endpoints instead

If you'd rather not use the generic KV mirror, call these directly:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | list products |
| POST | `/api/products` | `{ name, category, price }` |
| PUT | `/api/products/:id` | update a product |
| DELETE | `/api/products/:id` | delete a product |
| GET | `/api/coupons` | list coupons |
| POST | `/api/coupons` | `{ code, type: 'percent'\|'flat', value, expiry? }` |
| GET | `/api/coupons/validate/:code` | check if a code is usable right now |
| PATCH | `/api/coupons/:id/toggle` | activate/deactivate |
| DELETE | `/api/coupons/:id` | delete a coupon |
| GET | `/api/invoices?q=search` | list/search invoices |
| GET | `/api/invoices/:id` | fetch one invoice |
| POST | `/api/invoices` | create an invoice — invoice number, discount and total are computed **server-side** |

This is the better long-term option since coupon validation and invoice
totals are trust-sensitive and shouldn't be computed only in the browser.
I did not rewire the shipped HTML to use this option automatically because
it would mean rewriting most of the `invoice`/`products`/`coupons` tab
logic — happy to do that next if you want it.
