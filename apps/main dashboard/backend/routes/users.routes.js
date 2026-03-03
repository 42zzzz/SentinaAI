const express = require("express");
const bcrypt = require("bcrypt");
const core = require("../dbs/core.db");
const authenticate = require("../middleware/auth.middleware");
const { validatePassword } = require("../security/passwordPolicy");

const router = express.Router();

/* ===============================
   SUPER ADMIN CHECK
================================= */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

/* ===============================
   GET ALL USERS
================================= */
router.get("/", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await core.query(`
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.employee_id,
        u.status,
        u.created_at,
        u.last_active_at,
        r.role_id,
        r.role_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      ORDER BY u.user_id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   GET ROLES (EXCEPT SUPER ADMIN)
================================= */
router.get("/roles", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await core.query(`
      SELECT role_id, role_name
      FROM roles
      WHERE role_name != 'super_admin'
      ORDER BY role_id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   CREATE USER
================================= */
router.post("/", authenticate, requireSuperAdmin, async (req, res) => {
  const { full_name, email, password, role_id } = req.body;

  if (!full_name || !email || !password || !role_id) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const v = validatePassword(password, { email, name: full_name });
  if (!v.ok) {
      return res.status(400).json({ error: v.errors });
}

  const client = await core.connect();

  try {
    await client.query("BEGIN");

    /* CHECK DUPLICATE EMAIL */
    const emailCheck = await client.query(
      `SELECT user_id FROM users WHERE email = $1`,
      [email]
    );

    if (emailCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Email already exists" });
    }

    /* GENERATE NEXT EMPLOYEE ID SAFELY */
    const lastEmployee = await client.query(`
      SELECT employee_id
      FROM users
      WHERE employee_id LIKE 'ED-%'
      ORDER BY employee_id DESC
      LIMIT 1
    `);

    let nextNumber = 1;

    if (lastEmployee.rows.length > 0) {
      const lastId = lastEmployee.rows[0].employee_id; // ED-002
      const numeric = parseInt(lastId.split("-")[1]);
      nextNumber = numeric + 1;
    }

    const employee_id = `ED-${String(nextNumber).padStart(3, "0")}`;

    const hashed = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `INSERT INTO users
       (full_name, email, password_hash, employee_id, status, created_at)
       VALUES ($1,$2,$3,$4,'active',CURRENT_TIMESTAMP)
       RETURNING user_id`,
      [full_name, email, hashed, employee_id]
    );

    const userId = userResult.rows[0].user_id;

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1,$2)`,
      [userId, role_id]
    );

    await client.query("COMMIT");

    res.json({ message: "User created successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

/* ===============================
   UPDATE USER
================================= */
router.put("/:id", authenticate, requireSuperAdmin, async (req, res) => {
  const { full_name, email, role_id } = req.body;

  if (!full_name || !email || !role_id) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    await core.query(
      `UPDATE users
       SET full_name = $1,
           email = $2
       WHERE user_id = $3`,
      [full_name, email, req.params.id]
    );

    await core.query(
      `UPDATE user_roles
       SET role_id = $1
       WHERE user_id = $2`,
      [role_id, req.params.id]
    );

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   DELETE USER
================================= */
router.delete("/:id", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const check = await core.query(
      `SELECT r.role_name
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.user_id
       JOIN roles r ON r.role_id = ur.role_id
       WHERE u.user_id = $1`,
      [req.params.id]
    );

    if (!check.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    if (check.rows[0].role_name === "super_admin") {
      return res.status(400).json({ error: "Cannot delete super admin" });
    }

    await core.query(`DELETE FROM users WHERE user_id = $1`, [
      req.params.id,
    ]);

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;