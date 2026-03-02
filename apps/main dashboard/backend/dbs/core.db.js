const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const SSL_ENABLED = process.env.CORE_PGSSL === "true";

module.exports = new Pool({
  connectionString: process.env.CORE_DATABASE_URL,
  ssl: SSL_ENABLED
    ? {
        rejectUnauthorized: true,
        ca: fs.readFileSync(
          path.join(__dirname, "..", "certs", "server-ca.pem"),
          "utf8"
        ),
      }
    : false,
});