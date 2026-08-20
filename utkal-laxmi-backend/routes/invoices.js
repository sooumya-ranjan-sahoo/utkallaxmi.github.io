const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();
const newId = (prefix) => prefix + crypto.randomBytes(6).toString("hex");

function rowToInvoice(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    date: row.date,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_addr,
      email: row.customer_email,
    },
    paymentMode: row.payment_mode,
    deliveryLabel: row.delivery_label,
    items: JSON.parse(row.items_json),
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    total: row.total,
    couponCode: row.coupon_code,
    createdAt: row.created_at,
  };
}

router.get("/", (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT * FROM invoices
         WHERE LOWER(invoice_no) LIKE ? OR LOWER(customer_name) LIKE ?
         ORDER BY created_at DESC`
      )
      .all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare("SELECT * FROM invoices ORDER BY created_at DESC").all();
  }
  res.json(rows.map(rowToInvoice));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(rowToInvoice(row));
});

// Creates an invoice, computing the invoice number and totals server-side
// so the numbering can't collide/be spoofed by the client.
router.post("/", (req, res) => {
  const { date, customer, paymentMode, deliveryLabel, items, shipping, couponCode } = req.body;

  if (!customer || !customer.name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "customer.name and a non-empty items[] are required" });
  }

  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);

  let discount = 0;
  let appliedCouponCode = null;
  if (couponCode) {
    const coupon = db
      .prepare("SELECT * FROM coupons WHERE UPPER(code) = ?")
      .get(String(couponCode).toUpperCase());
    const today = new Date().toISOString().slice(0, 10);
    if (coupon && coupon.active && !(coupon.expiry && coupon.expiry < today)) {
      discount =
        coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
      discount = Math.min(discount, subtotal);
      appliedCouponCode = coupon.code;
    }
  }

  const shippingAmt = Number(shipping) || 0;
  const total = Math.max(0, subtotal - discount + shippingAmt);

  const year = new Date().getFullYear();
  const countThisYear = db
    .prepare("SELECT COUNT(*) AS n FROM invoices WHERE invoice_no LIKE ?")
    .get(`UL-${year}-%`).n;
  const invoiceNo = `UL-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

  const id = newId("inv_");
  db.prepare(
    `INSERT INTO invoices
      (id, invoice_no, date, customer_name, customer_phone, customer_addr, customer_email,
       payment_mode, delivery_label, items_json, subtotal, discount, shipping, total, coupon_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    invoiceNo,
    date || new Date().toISOString().slice(0, 10),
    customer.name,
    customer.phone || null,
    customer.address || null,
    customer.email || null,
    paymentMode || null,
    deliveryLabel || null,
    JSON.stringify(items),
    subtotal,
    discount,
    shippingAmt,
    total,
    appliedCouponCode
  );

  const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  res.status(201).json(rowToInvoice(row));
});

module.exports = router;
