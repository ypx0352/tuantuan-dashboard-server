const {
  resetPassword,
  sendVerificationCode,
} = require("../controllers/resetPassword");
const {
  resetPasswordValidation,
  sendVerificationCodeValidation,
} = require("../middleware/validation");

const router = require("express").Router();

router.put("/", resetPasswordValidation, resetPassword);

router.post(
  "/verification_code",
  sendVerificationCodeValidation,
  sendVerificationCode
);

module.exports = router;
