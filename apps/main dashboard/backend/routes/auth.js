const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const core = require("../dbs/core.db");
const authenticate = require("../middleware/auth.middleware");
const { validatePassword } = require("../security/passwordPolicy");

const router = express.Router();

/* ===============================
   LOCKOUT CONFIG
================================= */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/* ===============================
   LOGIN
================================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  req.audit = {
    eventType: "AUTH_ATTEMPT",
    action: "LOGIN",
    attemptedEmail: email || null,
    extra: {
      route: "/auth/login",
    },
  };

  try {
    const result = await core.query(
      `
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.password_hash,
        u.employee_id,
        u.failed_login_attempts,
        u.locked_until,
        u.last_failed_login_at,
        r.role_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE u.email = $1
      AND u.status = 'active'
      `,
      [email]
    );

    if (result.rows.length === 0) {
      req.audit.authResult = "FAILED";
      req.audit.failureReason = "USER_NOT_FOUND_OR_INACTIVE";
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check if account is currently locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      req.audit.authResult = "FAILED";
      req.audit.userId = user.user_id;
      req.audit.role = user.role_name;
      req.audit.failureReason = "ACCOUNT_LOCKED";

      return res.status(401).json({
        error: `Account locked. Try again after ${new Date(user.locked_until).toLocaleString()}`,
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      const currentFailedAttempts = Number(user.failed_login_attempts || 0);
      const newFailedAttempts = currentFailedAttempts + 1;

      let newLockedUntil = null;

      if (newFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        newLockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);

        await core.query(
          `
          UPDATE users
          SET 
            failed_login_attempts = $1,
            locked_until = $2,
            last_failed_login_at = CURRENT_TIMESTAMP
          WHERE user_id = $3
          `,
          [newFailedAttempts, newLockedUntil, user.user_id]
        );

        req.audit.authResult = "FAILED";
        req.audit.userId = user.user_id;
        req.audit.role = user.role_name;
        req.audit.failureReason = "ACCOUNT_LOCKED_AFTER_FAILED_ATTEMPTS";

        return res.status(401).json({
          error: `Account locked after too many failed attempts. Try again after ${newLockedUntil.toLocaleString()}`,
        });
      }

      await core.query(
        `
        UPDATE users
        SET 
          failed_login_attempts = $1,
          last_failed_login_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [newFailedAttempts, user.user_id]
      );

      req.audit.authResult = "FAILED";
      req.audit.userId = user.user_id;
      req.audit.role = user.role_name;
      req.audit.failureReason = "PASSWORD_MISMATCH";

      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Successful login: reset lockout fields
    await core.query(
      `
      UPDATE users 
      SET 
        last_active_at = CURRENT_TIMESTAMP,
        failed_login_attempts = 0,
        locked_until = NULL,
        last_failed_login_at = NULL
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

    req.audit.authResult = "SUCCESS";
    req.audit.userId = user.user_id;
    req.audit.role = user.role_name;

    res.json({
      token,
      role: user.role_name,
      full_name: user.full_name,
      employee_id: user.employee_id,
    });
  } catch (err) {
    console.error("Login error:", err);
    req.audit.authResult = "FAILED";
    req.audit.failureReason = "SERVER_ERROR";
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   CHANGE PASSWORD
================================= */
router.post("/change-password", authenticate, async (req, res) => {
  const userId = req.user.user_id;
  const { currentPassword, newPassword } = req.body;

  req.audit = {
    ...(req.audit || {}),
    eventType: "AUTH_ATTEMPT",
    action: "CHANGE_PASSWORD",
    userId,
    role: req.user.role,
    extra: {
      route: "/auth/change-password",
    },
  };

  if (!currentPassword || !newPassword) {
    req.audit.authResult = "FAILED";
    req.audit.failureReason = "MISSING_REQUIRED_FIELDS";
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
      req.audit.authResult = "FAILED";
      req.audit.failureReason = "USER_NOT_FOUND";
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      req.audit.authResult = "FAILED";
      req.audit.failureReason = "INVALID_CURRENT_PASSWORD";
      return res.status(401).json({ error: "Invalid current password" });
    }

    const v = validatePassword(newPassword, { email: user.email, name: user.full_name });
    if (!v.ok) {
      req.audit.authResult = "FAILED";
      req.audit.failureReason = "PASSWORD_POLICY_FAILED";
      req.audit.extra = {
        ...(req.audit.extra || {}),
        passwordPolicyErrors: v.errors,
      };
      return res.status(400).json({ error: v.errors });
    }

    const same = await bcrypt.compare(newPassword, user.password_hash);
    if (same) {
      req.audit.authResult = "FAILED";
      req.audit.failureReason = "PASSWORD_REUSE";
      return res.status(400).json({ error: ["New password must be different from the old password."] });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await core.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [hashed, userId]
    );

    req.audit.authResult = "SUCCESS";

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    req.audit.authResult = "FAILED";
    req.audit.failureReason = "SERVER_ERROR";
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