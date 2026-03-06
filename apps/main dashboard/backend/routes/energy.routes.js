// backend/routes/energy.routes.js
const express = require("express");
const energy = require("../controllers/energy.controller");

const router = express.Router();

router.get("/consumption", energy.getEnergyConsumption);
router.get("/top-halls-latest-day", energy.getTopHallsLatestDay);
router.get("/zones-latest-day", energy.getZonesLatestDay);        // Avg consumption per zone (kWh)
router.get("/sources-latest-day", energy.getSourcesLatestDay);    // By device type proxy (source)
router.get("/kpis-latest", energy.getEnergyKpisLatest);           // Efficiency score, load index, carbon
router.get("/anomalies-summary", energy.getSustAnomaliesSummary);
router.get("/kpis-24h", energy.getEnergyKpis24h);

module.exports = router;
