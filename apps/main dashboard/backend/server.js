// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ ok: true, service: "backend", time: new Date().toISOString() })
);

// Mount routes
const energyRoutes = require("./routes/energy.routes");
app.use("/energy", energyRoutes);
const devicesRoutes = require("./routes/devices.routes");
app.use("/devices", devicesRoutes);
const eventsRoutes = require("./routes/events.routes");
app.use("/events", eventsRoutes);
const exhibitorsRoutes = require("./routes/exhibitors.routes");
app.use("/exhibitors", exhibitorsRoutes);
const boothsRoutes = require("./routes/booths.routes");
app.use("/booths", boothsRoutes);
const dashboardRoutes = require("./routes/dashboard.routes");
app.use("/dashboard", dashboardRoutes);
const navRoutes = require("./routes/nav.routes");
app.use("/nav", navRoutes);


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));