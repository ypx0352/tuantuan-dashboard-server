const { getTodos } = require("../controllers/overview");
const authentication = require("../middleware/authentication");

const router = require("express").Router();

router.get("/todos", authentication, getTodos);

module.exports = router;
