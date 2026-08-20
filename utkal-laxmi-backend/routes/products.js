const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();
const newId = (prefix) => prefix + crypto.randomBytes(6).toString("hex");

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { name, category, price } = req.body;
  if (!name || typeof price !== "number" || Number.isNaN(price)) {
    return res.status(400).json({ error: "name and numeric price are required" });
  }
  const id = newId("p_");
  db.prepare("INSERT INTO products (id, name, category, price) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    category || null,
    price
  );
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const name = req.body.name ?? existing.name;
  const category = req.body.category ?? existing.category;
  const price = req.body.price ?? existing.price;

  db.prepare("UPDATE products SET name = ?, category = ?, price = ? WHERE id = ?").run(
    name,
    category,
    price,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ deleted: true, id: req.params.id });
});

module.exports = router;
