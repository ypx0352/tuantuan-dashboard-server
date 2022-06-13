const {
  addTransaction,
  getTransaction,
  approveTransaction,
} = require("../controllers/transaction");
const authentication = require("../middleware/authentication");
const {
  userAuthorization,
  adminAuthorization,
} = require("../middleware/authorization");

const router = require("express").Router();

router.post("/add", authentication, userAuthorization, addTransaction);

router.get("/all", authentication, userAuthorization, getTransaction);

router.put("/approve", authentication, adminAuthorization, approveTransaction);

module.exports = router;
