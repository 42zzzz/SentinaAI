// backend/routes/energy.routes.js
const express = require("express");
const energy = require("../controllers/energy.controller");

const router = express.Router();

router.get("/consumption", energy.getEnergyConsumption);
router.get("/top-halls-latest-day", energy.getTopHallsLatestDay);

module.exports = router;