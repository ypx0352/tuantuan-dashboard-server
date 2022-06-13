const router = require("express").Router();

const { getAllLogs } = require("../controllers/log");
const authentication = require("../middleware/authentication");
const { userAuthorization } = require("../middleware/authorization");

router.get("/all_logs", authentication, userAuthorization, getAllLogs);

module.exports = router;
