const express = require("express");
const Coupon = require("../models/Coupon");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

function computeDiscount(coupon, subtotal) {
  let discount = 0;

  if (coupon.discount_type === "percent") {
    discount = (subtotal * coupon.discount_value) / 100;
    if (coupon.max_discount && discount > coupon.max_discount) {
      discount = coupon.max_discount;
    }
  } else {
    discount = coupon.discount_value;
  }

  if (discount > subtotal) discount = subtotal;
  if (discount < 0) discount = 0;

  return Math.round(discount * 100) / 100;
}

function validateCoupon(coupon, subtotal) {
  if (!coupon || !coupon.active) {
    return "Invalid or inactive coupon code.";
  }
  if (coupon.expiry_date && new Date() > new Date(coupon.expiry_date)) {
    return "This coupon has expired.";
  }
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return "This coupon has reached its usage limit.";
  }
  if (subtotal < (coupon.min_order_amount || 0)) {
    return `Minimum order of ₹${coupon.min_order_amount} required for this coupon.`;
  }
  return null;
}

// Exported so routes/orders.js can re-validate + redeem atomically at order time.
async function redeemCoupon(code, subtotal) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

  const errorMsg = validateCoupon(coupon, subtotal);
  if (errorMsg) {
    return { ok: false, error: errorMsg };
  }

  // Atomic increment that also re-checks the usage limit, to avoid a race where
  // two people redeem the last available use of a limited coupon at the same time.
  const filter = { _id: coupon._id };
  if (coupon.usage_limit) {
    filter.used_count = { $lt: coupon.usage_limit };
  }

  const updated = await Coupon.findOneAndUpdate(
    filter,
    { $inc: { used_count: 1 } },
    { new: true }
  );

  if (!updated) {
    return { ok: false, error: "This coupon has just reached its usage limit." };
  }

  const discount_amount = computeDiscount(updated, subtotal);
  return { ok: true, code: updated.code, discount_amount };
}

// Public: preview a coupon's discount without redeeming it
router.post("/apply", async (req, res) => {
  const { code, subtotal } = req.body;

  if (!code || !subtotal) {
    return res.status(400).json({ valid: false, error: "Coupon code and order total are required." });
  }

  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    const errorMsg = validateCoupon(coupon, subtotal);

    if (errorMsg) {
      return res.status(400).json({ valid: false, error: errorMsg });
    }

    const discount_amount = computeDiscount(coupon, subtotal);
    const final_total = Math.round((subtotal - discount_amount) * 100) / 100;

    res.json({
      valid: true,
      code: coupon.code,
      discount_amount,
      final_total
    });
  } catch (err) {
    console.error("Coupon apply error:", err);
    res.status(500).json({ valid: false, error: "Could not validate coupon." });
  }
});

// Admin: list all coupons
router.get("/", adminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ created_at: -1 });
    res.json(coupons);
  } catch (err) {
    console.error("List coupons error:", err);
    res.status(500).json({ error: "Could not fetch coupons." });
  }
});

// Admin: create a coupon
router.post("/", adminAuth, async (req, res) => {
  const {
    code,
    discount_type,
    discount_value,
    max_discount,
    min_order_amount,
    usage_limit,
    expiry_date
  } = req.body;

  if (!code || !discount_type || discount_value === undefined || discount_value === null) {
    return res.status(400).json({ error: "Code, discount type, and discount value are required." });
  }

  if (!["percent", "flat"].includes(discount_type)) {
    return res.status(400).json({ error: "Discount type must be 'percent' or 'flat'." });
  }

  if (discount_type === "percent" && (discount_value <= 0 || discount_value > 100)) {
    return res.status(400).json({ error: "Percentage discount must be between 1 and 100." });
  }

  try {
    const normalizedCode = code.toUpperCase().trim();
    const existing = await Coupon.findOne({ code: normalizedCode });

    if (existing) {
      return res.status(409).json({ error: "A coupon with this code already exists." });
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      discount_type,
      discount_value,
      max_discount: max_discount || undefined,
      min_order_amount: min_order_amount || 0,
      usage_limit: usage_limit || undefined,
      expiry_date: expiry_date || undefined
    });

    res.status(201).json(coupon);
  } catch (err) {
    console.error("Create coupon error:", err);
    res.status(500).json({ error: "Could not create coupon." });
  }
});

// Admin: update a coupon (e.g. toggle active, adjust limits)
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.code) updates.code = updates.code.toUpperCase().trim();

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    res.json(coupon);
  } catch (err) {
    console.error("Update coupon error:", err);
    res.status(500).json({ error: "Could not update coupon." });
  }
});

// Admin: delete a coupon
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete coupon error:", err);
    res.status(500).json({ error: "Could not delete coupon." });
  }
});

module.exports = router;
module.exports.redeemCoupon = redeemCoupon;
