const express = require("express");
const Order = require("../models/Order");

const router = express.Router();

router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ created_at: -1 })
      .limit(300)
      .lean();

    res.json(orders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;
