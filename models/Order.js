const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    item_name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, default: 1 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    order_no: { type: String, required: true, unique: true },
    customer_name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    delivery_type: { type: String, default: "Table Delivery" },
    address: { type: String },
    subtotal: { type: Number },
    coupon_code: { type: String },
    discount_amount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    payment_method: { type: String, default: "Cash" },
    payment_status: { type: String, default: "Pending" },
    razorpay_order_id: { type: String },
    razorpay_payment_id: { type: String },
    items: { type: [orderItemSchema], required: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "orders" // explicit — keeps the collection name stable
  }
);

module.exports = mongoose.model("Order", orderSchema);
