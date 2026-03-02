const express = require("express");
const dash = require("../controllers/dashboard.controller");
const router = express.Router();

router.get("/overview", dash.getOverview);
router.get("/zones-summary", dash.getZonesSummary);
router.get("/map", dash.getMapLayer);
router.get("/debug-db", dash.debugDb);

module.exports = router;