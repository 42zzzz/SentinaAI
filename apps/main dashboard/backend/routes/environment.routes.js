const router = require("express").Router();
const c = require("../controllers/environment.controller");

router.get("/overview", c.getEnvironmentOverview);
router.get("/by-zone", c.getEnvironmentByZone);
router.get("/anomalies", c.getEnvironmentAnomalies);

module.exports = router;