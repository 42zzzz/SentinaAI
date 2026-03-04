const express = require("express");
const dash = require("../controllers/dashboard.controller");
const router = express.Router();

router.get("/overview", dash.getOverview);
router.get("/zones-summary", dash.getZonesSummary);
router.get("/trends", dash.getTrends);
router.get("/top-halls", dash.getTopHalls);
router.get("/map", dash.getMapLayer);
router.get("/debug-db", dash.debugDb);
router.get("/device-status", dash.getDeviceStatusSummary);
router.get("/alerts-trend", dash.getAlertsTrend);

module.exports = router;