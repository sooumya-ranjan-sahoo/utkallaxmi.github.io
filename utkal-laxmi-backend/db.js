// db.js
// SQLite database setup. Uses a single file on disk (data/utkal-laxmi.db)
// so all data survives server restarts. No external database needed.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "utkal-laxmi.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------
// Generic key-value store.
// This mirrors the shape the frontend already expects from
// window.storage.get/set (key -> JSON value), so the existing
// loadKey()/saveKey() calls in the HTML file need almost no changes.
// ---------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------------------------------------------------------------
// Proper relational tables as well, for anyone who wants real
// querying/reporting instead of a single JSON blob per key.
// The /api/kv/* routes are the ones the shipped frontend uses;
// the /api/products, /api/coupons, /api/invoices routes are a
// nicer REST alternative if you later refactor the frontend.
// ---------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT,
    price       REAL NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id          TEXT PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    type        TEXT NOT NULL CHECK (type IN ('percent','flat')),
    value       REAL NOT NULL,
    expiry      TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id             TEXT PRIMARY KEY,
    invoice_no     TEXT NOT NULL UNIQUE,
    date           TEXT NOT NULL,
    customer_name  TEXT NOT NULL,
    customer_phone TEXT,
    customer_addr  TEXT,
    customer_email TEXT,
    payment_mode   TEXT,
    delivery_label TEXT,
    items_json     TEXT NOT NULL,
    subtotal       REAL NOT NULL,
    discount       REAL NOT NULL DEFAULT 0,
    shipping       REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL,
    coupon_code    TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
