// Temporary diagnostic + fix script — delete after use
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool({
  connectionString: process.env.CORE_DATABASE_URL,
  ssl:
    process.env.CORE_PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

async function main() {
  const email = "operations@sentina.ai";
  const password = "Operations.123";

  console.log("Connecting to:", process.env.CORE_DATABASE_URL?.replace(/:([^:@]+)@/, ":***@"));

  // 1. Check user
  const { rows } = await pool.query(
    `SELECT u.user_id, u.email, u.status, u.failed_login_attempts, u.locked_until, u.password_hash,
            (SELECT COUNT(*) FROM user_roles ur WHERE ur.user_id = u.user_id) AS role_count,
            (SELECT r.role_name FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id LIMIT 1) AS role_name
     FROM users u WHERE u.email = $1`,
    [email]
  );

  if (!rows.length) {
    console.log("❌ User not found. Creating...");
    const hash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const emp = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INT)), 0) + 1 AS n FROM users WHERE employee_id ~ '^ED-'`
      );
      const employeeId = `ED-${String(emp.rows[0].n).padStart(3, "0")}`;
      const ins = await client.query(
        `INSERT INTO users (full_name, email, password_hash, employee_id, status, created_at, consent_given_at, consent_version)
         VALUES ($1,$2,$3,$4,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'v1.0') RETURNING user_id`,
        ["Operations Manager", email, hash, employeeId]
      );
      const userId = ins.rows[0].user_id;
      const role = await client.query(
        `SELECT role_id FROM roles WHERE role_name = 'operations_manager'`
      );
      if (!role.rows.length) throw new Error("Role 'operations_manager' not found in roles table");
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)`,
        [userId, role.rows[0].role_id]
      );
      await client.query("COMMIT");
      console.log(`✅ User created: user_id=${userId} employee_id=${employeeId}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await pool.end();
    return;
  }

  const user = rows[0];
  console.log("User found:", {
    status: user.status,
    failed_login_attempts: user.failed_login_attempts,
    locked_until: user.locked_until,
    role_count: user.role_count,
    role_name: user.role_name,
  });

  // 2. Fix status
  if (user.status !== "active") {
    await pool.query(`UPDATE users SET status = 'active' WHERE user_id = $1`, [user.user_id]);
    console.log("✅ Status set to active");
  } else {
    console.log("✅ Status is active");
  }

  // 3. Unlock if locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_failed_login_at = NULL WHERE user_id = $1`,
      [user.user_id]
    );
    console.log("✅ Account unlocked");
  } else {
    console.log("✅ Account not locked");
  }

  // 4. Fix missing role
  if (parseInt(user.role_count) === 0) {
    const role = await pool.query(
      `SELECT role_id FROM roles WHERE role_name = 'operations_manager'`
    );
    if (!role.rows.length) {
      console.log("❌ Role 'operations_manager' not found in roles table");
    } else {
      await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)`, [
        user.user_id,
        role.rows[0].role_id,
      ]);
      console.log("✅ Role assigned: operations_manager");
    }
  } else {
    console.log("✅ Role assigned:", user.role_name);
  }

  // 5. Check and fix password
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    console.log("❌ Password hash mismatch. Resetting password...");
    const hash = await bcrypt.hash(password, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [
      hash,
      user.user_id,
    ]);
    console.log("✅ Password reset to Operations.123");
  } else {
    console.log("✅ Password hash matches");
  }

  await pool.end();
  console.log("\nDone. Try logging in now.");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
