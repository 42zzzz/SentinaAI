const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const core = require("../dbs/core.db");
const authenticate = require("../middleware/auth.middleware");
const { validatePassword } = require("../security/passwordPolicy");

const router = express.Router();

/* ===============================
   LOGIN (DEBUG)
================================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("========== LOGIN ATTEMPT ==========");
  console.log("Raw email received:", JSON.stringify(email));
  console.log("Raw password received:", JSON.stringify(password));

  try {
    const result = await core.query(
      `
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.password_hash,
        u.employee_id,
        r.role_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE u.email = $1
      AND u.status = 'active'
      `,
      [email]
    );

    console.log("Rows returned from DB:", result.rows.length);

    if (result.rows.length === 0) {
      console.log("No user found with that email + active status");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    console.log("DB email:", user.email);
    console.log("Stored hash:", user.password_hash);

    const match = await bcrypt.compare(password, user.password_hash);

    console.log("Password match result:", match);

    if (!match) {
      console.log("Password mismatch");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await core.query(
      `
      UPDATE users 
      SET last_active_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1
      `,
      [user.user_id]
    );

    const token = jwt.sign(
      {
        user_id: user.user_id,
        role: user.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    console.log("Login successful for:", user.email);

    res.json({
      token,
      role: user.role_name,
      full_name: user.full_name,
      employee_id: user.employee_id,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   CHANGE PASSWORD
================================= */
router.post("/change-password", authenticate, async (req, res) => {
  const userId = req.user.user_id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }

  try {
    const result = await core.query(
      `SELECT user_id, full_name, email, password_hash
       FROM users
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    // Enforce strong policy
    const v = validatePassword(newPassword, { email: user.email, name: user.full_name });
    if (!v.ok) {
      return res.status(400).json({ error: v.errors });
    }

    // Prevent reusing same password
    const same = await bcrypt.compare(newPassword, user.password_hash);
    if (same) {
      return res.status(400).json({ error: ["New password must be different from the old password."] });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await core.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [hashed, userId]
    );

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


/* ===============================
   TEST ROUTE
================================= */
router.get("/test", (req, res) => {
  res.json({ message: "Auth route works" });
});

module.exports = router;