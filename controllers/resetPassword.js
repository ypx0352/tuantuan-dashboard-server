const bcrypt = require("bcrypt");

const {
  generalHandleWithoutTransaction,
  typeToModel,
  sendEmail,
  generateEmailHtml,
  generalHandle,
  writeLog,
} = require("./static");

const resetPassword = async (req, res) => {
  generalHandle(async (session) => {
    const { email, name, code, password } = req.body;

    const recordInUser = await typeToModel("user").findOne({ email: email });

    // Check if the verification code is correct.
    if (code !== recordInUser.nextVerificationCode) {
      return res.status(400).json({ msg: "Verification code is incorrect." });
    }

    // Check if the password is the same as original password.
    const same = await bcrypt.compare(password, recordInUser.password);
    if (same) {
      return res.status(400).json({
        msg: "The new password cannot be the same as the original password.",
      });
    }

    // Change the password and reset the nextVerificationCode.
    const nextVerificationCode = Math.random().toString(36).substring(2, 8);
    const newHashedPassword = await bcrypt.hash(password, 10);
    await typeToModel("user").findOneAndUpdate(
      { email: email },
      { $set: { nextVerificationCode, password: newHashedPassword } }
    );

    // Write the log.
    await writeLog(name, "Change password.", "", session);

    // Send email to inform the user.
    await sendEmail(
      email,
      "Password changed",
      generateEmailHtml(
        `Hi ${name},`,
        `Your password has been changed successfully. If this is not your operation, please contact the administrator immediately, as your account has probably been compromised. `
      )
    );

    return "Your password has been changed successfully.";
  }, res);
};

const sendVerificationCode = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { email, name } = req.body;
      // Check if the email is registered.
      const recordInUser = await typeToModel("user").findOne({ email: email });
      if (recordInUser === null) {
        return res.status(400).json({ msg: "This email is not registered." });
      }

      // Check if the username is correct.
      if (name !== recordInUser.name) {
        return res
          .status(400)
          .json({ msg: "The combination of email and username is incorrect." });
      }

      // Check if the email has been verified.
      if (!recordInUser.emailVerified) {
        return res.status(400).json({
          msg: "The email is not verified.",
        });
      }

      // Check if the account is activated.
      if (!recordInUser.active) {
        return res.status(400).json({
          msg: "The account is deactivated.",
        });
      }

      // Send the verification code via email.
      await sendEmail(
        email,
        "Verification code",
        generateEmailHtml(
          `Hi ${name},`,
          `Your verification code for resetting password is ${recordInUser.nextVerificationCode}.`
        )
      );

      res
        .status(200)
        .json({ msg: "Verification code is sent to your email address." });
    },
    res,
    "Failed to send verification code. Server error."
  );
};

module.exports = { resetPassword, sendVerificationCode };
