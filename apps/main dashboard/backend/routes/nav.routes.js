// backend/routes/nav.routes.js
const express = require("express");
const router = express.Router();

const NAV_BASE = process.env.NAVMESH_BASE_URL || "http://127.0.0.1:5000";

async function forward(req, res, path, method = "GET") {
  try {
    const url = `${NAV_BASE}${path}`;
    const opts = { method, headers: { "Content-Type": "application/json" } };

    if (method !== "GET" && method !== "HEAD") {
      opts.body = JSON.stringify(req.body || {});
    }

    const r = await fetch(url, opts);
    const contentType = r.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const buf = Buffer.from(await r.arrayBuffer());
      res.status(r.status);
      res.setHeader("Content-Type", contentType);
      return res.send(buf);
    }

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: `Navmesh proxy failed: ${e.message}` });
  }
}

router.get("/health", (req, res) => forward(req, res, "/api/health"));
router.get("/rooms", (req, res) => forward(req, res, "/api/rooms"));
router.get("/navmesh", (req, res) => forward(req, res, "/api/navmesh"));
router.post("/pathfind", (req, res) => forward(req, res, "/api/pathfind", "POST"));
router.post("/iot/update", (req, res) => forward(req, res, "/api/iot/update", "POST"));

module.exports = router;