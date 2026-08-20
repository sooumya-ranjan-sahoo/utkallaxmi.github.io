// routes/kv.js
// Generic key-value endpoints that mirror the Artifacts window.storage
// API the frontend already calls. This lets the shipped HTML file work
// as-is (after swapping loadKey/saveKey to call these routes instead
// of window.storage) with virtually no other code changes.

const express = require("express");
const db = require("../db");

const router = express.Router();

const KEY_RE = /^[A-Za-z0-9_\-:.]{1,200}$/;

function validKey(key) {
  return typeof key === "string" && KEY_RE.test(key);
}

// GET /api/kv/:key  -> { key, value }
router.get("/:key", (req, res) => {
  const { key } = req.params;
  if (!validKey(key)) return res.status(400).json({ error: "Invalid key" });

  const row = db.prepare("SELECT key, value FROM kv_store WHERE key = ?").get(key);
  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json({ key: row.key, value: JSON.parse(row.value) });
});

// PUT /api/kv/:key   body: { value: <any JSON> }  -> upsert
router.put("/:key", (req, res) => {
  const { key } = req.params;
  if (!validKey(key)) return res.status(400).json({ error: "Invalid key" });

  if (!("value" in req.body)) {
    return res.status(400).json({ error: "Request body must include 'value'" });
  }

  const json = JSON.stringify(req.body.value);

  db.prepare(
    `INSERT INTO kv_store (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, json);

  return res.json({ key, value: req.body.value });
});

// DELETE /api/kv/:key
router.delete("/:key", (req, res) => {
  const { key } = req.params;
  if (!validKey(key)) return res.status(400).json({ error: "Invalid key" });

  const info = db.prepare("DELETE FROM kv_store WHERE key = ?").run(key);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });

  return res.json({ key, deleted: true });
});

// GET /api/kv?prefix=ul_  -> { keys: [...] }
router.get("/", (req, res) => {
  const prefix = req.query.prefix || "";
  const rows = db
    .prepare("SELECT key FROM kv_store WHERE key LIKE ? ORDER BY key")
    .all(prefix + "%");
  return res.json({ keys: rows.map((r) => r.key) });
});

module.exports = router;
