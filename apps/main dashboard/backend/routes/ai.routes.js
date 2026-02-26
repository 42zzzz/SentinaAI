// routes/ai.routes.js
const router = require("express").Router();
const ai = require("../controllers/ai.controller");

router.get("/venue-status", ai.getVenueStatus);
router.post("/simulate-prediction", ai.simulatePrediction);

module.exports = router;