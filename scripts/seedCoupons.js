// One-time helper to create the MESS10 and MESS50 coupons.
// Run with:  node scripts/seedCoupons.js
//
// Edit the values below before running if you want different discounts,
// minimum order amounts, usage limits, or expiry dates.

require("dotenv").config();
const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");

const couponsToSeed = [
  {
    code: "MESS10",
    discount_type: "percent",
    discount_value: 10,
    max_discount: 100,     // cap the 10% off at ₹100 — remove this line for no cap
    min_order_amount: 0,
    usage_limit: undefined, // unlimited uses — set a number to limit redemptions
    expiry_date: undefined, // no expiry — set e.g. new Date("2026-12-31") to add one
    active: true
  },
  {
    code: "MESS50",
    discount_type: "flat",
    discount_value: 50,
    min_order_amount: 300, // requires a ₹300+ order — change or remove as you like
    usage_limit: undefined,
    expiry_date: undefined,
    active: true
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "gowtham_mess"
  });

  console.log("Connected to MongoDB:", mongoose.connection.name);

  for (const data of couponsToSeed) {
    const existing = await Coupon.findOne({ code: data.code });

    if (existing) {
      console.log(`Skipped ${data.code} — already exists.`);
      continue;
    }

    await Coupon.create(data);
    console.log(`Created coupon: ${data.code}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
