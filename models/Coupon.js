const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    discount_type: {
      type: String,
      enum: ["percent", "flat"],
      required: true
    },
    discount_value: { type: Number, required: true }, // % if percent, ₹ if flat
    max_discount: { type: Number },   // optional cap on a percent discount
    min_order_amount: { type: Number, default: 0 },
    usage_limit: { type: Number },    // optional total redemptions allowed
    used_count: { type: Number, default: 0 },
    expiry_date: { type: Date },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "coupons"
  }
);

module.exports = mongoose.model("Coupon", couponSchema);
