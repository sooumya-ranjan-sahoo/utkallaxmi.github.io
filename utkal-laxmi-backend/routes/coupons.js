const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();
const newId = (prefix) => prefix + crypto.randomBytes(6).toString("hex");

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
  res.json(rows.map((r) => ({ ...r, active: !!r.active })));
});

// Validate a coupon code for use on an order (mirrors the frontend's applyCoupon logic)
router.get("/validate/:code", (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const row = db
    .prepare("SELECT * FROM coupons WHERE UPPER(code) = ?")
    .get(code);

  if (!row) return res.status(404).json({ valid: false, reason: "Invalid coupon code." });
  if (!row.active) return res.status(400).json({ valid: false, reason: "This coupon is inactive." });

  const today = new Date().toISOString().slice(0, 10);
  if (row.expiry && row.expiry < today) {
    return res.status(400).json({ valid: false, reason: "This coupon has expired." });
  }

  return res.json({ valid: true, coupon: { ...row, active: !!row.active } });
});

router.post("/", (req, res) => {
  const { code, type, value, expiry } = req.body;
  if (!code || !["percent", "flat"].includes(type) || typeof value !== "number") {
    return res.status(400).json({ error: "code, type ('percent'|'flat'), and numeric value are required" });
  }

  const dup = db.prepare("SELECT 1 FROM coupons WHERE UPPER(code) = ?").get(code.toUpperCase());
  if (dup) return res.status(409).json({ error: "That code already exists." });

  const id = newId("c_");
  db.prepare(
    "INSERT INTO coupons (id, code, type, value, expiry, active) VALUES (?, ?, ?, ?, ?, 1)"
  ).run(id, code.toUpperCase(), type, value, expiry || null);

  const row = db.prepare("SELECT * FROM coupons WHERE id = ?").get(id);
  res.status(201).json({ ...row, active: !!row.active });
});

router.patch("/:id/toggle", (req, res) => {
  const row = db.prepare("SELECT * FROM coupons WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });

  db.prepare("UPDATE coupons SET active = ? WHERE id = ?").run(row.active ? 0 : 1, req.params.id);
  const updated = db.prepare("SELECT * FROM coupons WHERE id = ?").get(req.params.id);
  res.json({ ...updated, active: !!updated.active });
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM coupons WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ deleted: true, id: req.params.id });
});

module.exports = router;
