const express = require("express");
const router = express.Router();
const { register, verifyEmail } = require("../controllers/register");
const { registerValidation } = require("../middleware/validation");

router.post("/", registerValidation, register);

router.get("/verify_email", verifyEmail);

module.exports = router;
