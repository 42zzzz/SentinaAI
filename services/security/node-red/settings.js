/**
 * Node-RED settings
 *
 * Implements NFR-28 by serving the editor/API over HTTPS.
 *
 * NOTE: This is a minimal config for local demo.
 * For production, add proper adminAuth and disable the editor if needed.
 */

const fs = require("fs");

module.exports = {
  uiPort: process.env.PORT || 1880,

  // Serve over HTTPS
  https: {
    key: fs.readFileSync("/data/certs/nodered.key"),
    cert: fs.readFileSync("/data/certs/nodered.crt"),
    ca: fs.readFileSync("/data/certs/ca.crt"),
  },

  // Recommended hardening (optional for demo)
  // adminAuth: {
  //   type: "credentials",
  //   users: [{
  //     username: "admin",
  //     password: "<bcrypt-hash>",
  //     permissions: "*"
  //   }]
  // },

  // Disable project features unless you need them
  editorTheme: {
    projects: {
      enabled: false,
    },
  },
};
