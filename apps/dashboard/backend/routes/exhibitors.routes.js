// backend/routes/exhibitors.routes.js
const express = require("express");
const exhibitors = require("../controllers/exhibitors.controller");

const router = express.Router();

router.get("/filters", exhibitors.getExhibitorFilters);
router.get("/", exhibitors.listExhibitors);
router.get("/:exhibitor_id", exhibitors.getExhibitorById);
router.get("/:exhibitor_id/events", exhibitors.getExhibitorEvents);

module.exports = router;