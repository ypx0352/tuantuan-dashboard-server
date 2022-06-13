const router = require("express").Router();
const {
  getOrder,
  getExchangeRate,
  submitOrder,
} = require("../controllers/order");
const authentication = require("../middleware/authentication");
const {
  userAuthorization,
  adminAuthorization,
} = require("../middleware/authorization");

router.get("/:pk_id", authentication, userAuthorization, getOrder);
router.get("/tools/exchange_rate", getExchangeRate);
router.post("/submit", authentication, adminAuthorization, submitOrder);

module.exports = router;
