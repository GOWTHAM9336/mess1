require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");

const paymentRoutes = require("./routes/payment");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const couponRoutes = require("./routes/coupons");
const adminAuth = require("./middleware/adminAuth");

const app = express();

app.use(cors());
app.use(express.json());

// Make sure the DB is connected before any request is handled.
// connectDB() reuses the existing connection on warm serverless invocations.
app.use((req, res, next) => {
  connectDB()
    .then(() => next())
    .catch((err) => {
      console.error("DB connection error on request:", err);
      res.status(500).json({ error: "Database connection failed" });
    });
});

// Serves index.html, script.js, style.css, images, etc.
app.use(express.static(path.join(__dirname, "public")));

// Public API
app.use("/api/payment", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/coupons", couponRoutes); // has its own per-route admin auth (see routes/coupons.js)

// Protected admin API + dashboard page
// Admin API
app.use("/api/admin", adminRoutes);

// Admin Dashboard
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});
app.use((req, res) => {
  res.status(404).send("Not found");
});

// Only start a listening server when run directly (local dev / traditional hosting).
// On Vercel, this file is imported as a serverless handler instead — see api/index.js.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Gowtham Mess server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("\n❌ Could not start the server — MongoDB connection failed.");
      console.error("   Check that MONGODB_URI in your .env file is correct and reachable,");
      console.error("   and that MongoDB is actually running (e.g. `mongod`, or your Atlas cluster is up).\n");
      console.error("   Underlying error:", err.message || err);
      process.exit(1);
    });
}

module.exports = app;
