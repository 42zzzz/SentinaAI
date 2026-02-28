// backend/server.js (ESM-safe)
// NOTE: Your package.json is running Node as ES module ("type": "module"),
// so we must use `import` instead of `require`.
// Hi 

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ ok: true, service: "backend", time: new Date().toISOString() })
);


// --- Exhibitor AI proxy (FastAPI) ---
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Basic health passthrough
app.get("/api/exhibitor-ai/health", async (req, res) => {
  try {
    const r = await fetch(`${AI_SERVICE_URL}/health`);
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "Exhibitor AI service unreachable", detail: String(e) });
  }
});

// JSON passthrough for AI endpoints  ✅ FIXED: *path
app.get("/api/exhibitor-ai/*path", async (req, res) => {
  try {
    const path = req.originalUrl.replace("/api/exhibitor-ai", "");
    const r = await fetch(`${AI_SERVICE_URL}${path}`);
    const contentType = r.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      res.status(r.status).json(await r.json());
    } else {
      res.status(r.status).send(await r.text());
    }
  } catch (e) {
    res.status(502).json({ error: "Exhibitor AI proxy failed", detail: String(e) });
  }
});

// File passthrough for XLSX downloads ✅ FIXED: *path
app.get("/api/exhibitor-ai-download/*path", async (req, res) => {
  try {
    const path = req.originalUrl.replace("/api/exhibitor-ai-download", "");
    const r = await fetch(`${AI_SERVICE_URL}${path}`);

    const disp = r.headers.get("content-disposition");
    const type = r.headers.get("content-type");
    if (disp) res.setHeader("Content-Disposition", disp);
    if (type) res.setHeader("Content-Type", type);

    res.status(r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: "Exhibitor AI download proxy failed", detail: String(e) });
  }
});


// ----------------------
// Mount routes (ESM-safe)
// ----------------------
// Your route files likely use `module.exports = router;` (CommonJS).
// In ESM, import them and use `.default || module` to support both.

import energyRoutesImport from "./routes/energy.routes.js";
import devicesRoutesImport from "./routes/devices.routes.js";
import eventsRoutesImport from "./routes/events.routes.js";
import exhibitorsRoutesImport from "./routes/exhibitors.routes.js";
import boothsRoutesImport from "./routes/booths.routes.js";
import dashboardRoutesImport from "./routes/dashboard.routes.js";
import navRoutesImport from "./routes/nav.routes.js";
import aiRoutesImport from "./routes/ai.routes.js";

const energyRoutes = energyRoutesImport?.default || energyRoutesImport;
const devicesRoutes = devicesRoutesImport?.default || devicesRoutesImport;
const eventsRoutes = eventsRoutesImport?.default || eventsRoutesImport;
const exhibitorsRoutes = exhibitorsRoutesImport?.default || exhibitorsRoutesImport;
const boothsRoutes = boothsRoutesImport?.default || boothsRoutesImport;
const dashboardRoutes = dashboardRoutesImport?.default || dashboardRoutesImport;
const navRoutes = navRoutesImport?.default || navRoutesImport;
const aiRoutes = aiRoutesImport?.default || aiRoutesImport;

app.use("/energy", energyRoutes);
app.use("/devices", devicesRoutes);
app.use("/events", eventsRoutes);
app.use("/exhibitors", exhibitorsRoutes);
app.use("/booths", boothsRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/nav", navRoutes);
app.use("/ai", aiRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));