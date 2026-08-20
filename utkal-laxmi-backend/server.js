// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const kvRoutes = require("./routes/kv");
const productRoutes = require("./routes/products");
const couponRoutes = require("./routes/coupons");
const invoiceRoutes = require("./routes/invoices");

const app = express();
const PORT = process.env.PORT || 4000;

// ---- security & parsing middleware ----
app.use(helmet());
app.use(express.json({ limit: "2mb" }));

const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120, // 120 requests/minute/IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---- optional simple API key auth ----
// Set API_KEY in .env to require this header on every request:
//   x-api-key: <your key>
// Leave API_KEY unset in .env to disable auth entirely (e.g. local dev).
app.use((req, res, next) => {
  const requiredKey = process.env.API_KEY;
  if (!requiredKey) return next(); // auth disabled
  if (req.path === "/health") return next(); // health check always open

  const suppliedKey = req.header("x-api-key");
  if (suppliedKey && suppliedKey === requiredKey) return next();
  return res.status(401).json({ error: "Unauthorized: missing or invalid x-api-key header" });
});

// ---- routes ----
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/kv", kvRoutes);
app.use("/api/products", productRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/invoices", invoiceRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Utkal Laxmi backend running on http://localhost:${PORT}`);
});
