const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: { type: String, required: true, trim: true },
    password_hash: { type: String, required: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "users"
  }
);

module.exports = mongoose.model("User", userSchema);
