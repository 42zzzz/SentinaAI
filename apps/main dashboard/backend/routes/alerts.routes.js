const express = require("express");
const ctrl = require("../controllers/alerts.controller");

const router = express.Router();

router.get("/filters", ctrl.getAlertFilters);
router.get("/", ctrl.listAlerts);

router.patch("/:id/ack", ctrl.acknowledgeAlert);
router.patch("/:id/resolve", ctrl.resolveAlert);

router.post("/run-engine", ctrl.runEngineOnce);

module.exports = router;