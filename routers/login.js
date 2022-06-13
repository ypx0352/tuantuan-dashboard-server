const router = require("express").Router();
const login = require("../controllers/login");
const { loginValidation } = require("../middleware/validation");

router.post("/", loginValidation, login);

module.exports = router;
