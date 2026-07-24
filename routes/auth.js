const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const userAuth = require("../middleware/userAuth");

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Never send password_hash back to the client.
function publicUser(user) {
  return {
    id: user._id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone
  };
}

router.post("/signup", async (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body;

  if (!full_name || !email || !phone || !password || !confirm_password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      full_name: full_name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password_hash
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Could not create account. Please try again." });
  }
});

// Frontend labels this "Username (or Email)" — accounts are keyed by email underneath,
// since there's no separate username field at signup.
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Please enter your email and password." });
  }

  try {
    const user = await User.findOne({ email: identifier.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Could not log in. Please try again." });
  }
});

router.get("/me", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("Fetch profile error:", err);
    res.status(500).json({ error: "Could not fetch profile." });
  }
});

router.put("/profile", userAuth, async (req, res) => {
  const { full_name, email, phone } = req.body;

  if (!full_name || !email || !phone) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.userId }
    });

    if (existing) {
      return res.status(409).json({ error: "Another account already uses this email." });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { full_name: full_name.trim(), email: normalizedEmail, phone: phone.trim() },
      { new: true }
    );

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Could not update profile." });
  }
});

router.put("/password", userAuth, async (req, res) => {
  const { current_password, new_password, confirm_new_password } = req.body;

  if (!current_password || !new_password || !confirm_new_password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (new_password !== confirm_new_password) {
    return res.status(400).json({ error: "New passwords do not match." });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const match = await bcrypt.compare(current_password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Could not change password." });
  }
});

module.exports = router;
