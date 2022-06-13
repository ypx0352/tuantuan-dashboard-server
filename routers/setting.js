const router = require("express").Router();
const { getSetting, setSetting } = require("../controllers/setting");
const authentication = require("../middleware/authentication");
const { adminAuthorization } = require("../middleware/authorization");

router.get("/", authentication, getSetting);

router.put("/", authentication, adminAuthorization, setSetting);

module.exports = router;
