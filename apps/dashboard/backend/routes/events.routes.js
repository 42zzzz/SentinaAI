// backend/routes/events.routes.js
const express = require("express");
const events = require("../controllers/events.controller");

const router = express.Router();

router.get("/filters", events.getEventFilters);
router.get("/", events.listEvents);
router.get("/:event_id", events.getEventById);

module.exports = router;