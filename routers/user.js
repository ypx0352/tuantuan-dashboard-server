const { getUserInfo } = require("../controllers/user");
const authentication = require("../middleware/authentication");

const router = require("express").Router();

router.get("/user_info", authentication, getUserInfo);

module.exports = router;
