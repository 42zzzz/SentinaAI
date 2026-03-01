// backend/server.js (CommonJS)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

// ---- Ensure fetch exists (Node <18) ----
if (typeof global.fetch !== "function") {
  try {
    // IMPORTANT: install node-fetch@2 (see step 3)
    global.fetch = require("node-fetch");
  } catch (e) {
    console.warn(
      "❌ fetch() is not available. Install node-fetch@2 or upgrade Node to 18+."
    );
  }
}

const app = express();

// ✅ Avoid CORS causing “Failed to fetch” (localhost vs 127.0.0.1 etc.)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ ok: true, service: "backend", time: new Date().toISOString() })
);

// --- Exhibitor AI proxy (FastAPI) ---
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

app.get("/api/exhibitor-ai/health", async (req, res) => {
  try {
    const r = await fetch(`${AI_SERVICE_URL}/health`);
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "Exhibitor AI service unreachable", detail: String(e) });
  }
});

// JSON passthrough for AI endpoints
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
// Mount routes (CommonJS)
// ----------------------
app.use("/energy", require("./routes/energy.routes.js"));
app.use("/devices", require("./routes/devices.routes.js"));
app.use("/events", require("./routes/events.routes.js"));
app.use("/exhibitors", require("./routes/exhibitors.routes.js"));
app.use("/booths", require("./routes/booths.routes.js"));
app.use("/dashboard", require("./routes/dashboard.routes.js"));
app.use("/nav", require("./routes/nav.routes.js"));
app.use("/ai", require("./routes/ai.routes.js"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));