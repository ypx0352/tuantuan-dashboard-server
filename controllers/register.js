const bcrypt = require("bcrypt");
const {
  typeToModel,
  generalHandle,
  writeLog,
  sendEmail,
  generateEmailHtml,
} = require("./static");

const register = async (req, res) => {
  generalHandle(async (session) => {
    var { name, email, registerCode, password } = req.body;

    // Check duplication of email address in database
    const result = await typeToModel("user").findOne({
      $or: [{ name: name }, { email: email }],
    });
    if (result !== null) {
      return res.status(400).json({ msg: "User exists, please login." });
    }

    // Assign user's role according to register code
    const registerCodeToRole = {
      TUANTUAN_ADMIN: "admin",
      TUANTUAN_USER: "user",
      VISITOR: "visitor",
    };

    const role = registerCodeToRole[registerCode];
    if (role === undefined) {
      return res.status(400).json({ msg: "Register code is incorrect." });
    }

    // Generate 6-digit verification code used for resetting password
    const nextVerificationCode = Math.random().toString(36).substring(2, 8);

    // Save register data to database
    password = await bcrypt.hash(password, 10);
    await typeToModel("user").create(
      [{ name, email, password, role, nextVerificationCode }],
      {
        session: session,
      }
    );

    // Send verification email.
    await sendEmail(
      email,
      "Email verification",
      generateEmailHtml(
        `Hi ${name},`,
        ` Please click the following URL to verify your email. <a href=\`${process.env.SERVER_BASE_URL}/api/register/verify_email?username=${name}\`>${process.env.SERVER_BASE_URL}/api/register/verify_email?username=${name}</a>`
      )
    );

    // Write the log
    await writeLog(name, "Register", "", session);

    return "Your account has been registered successfully. Please login.";
  }, res);
};

const verifyEmail = async (req, res) => {
  try {
    // Verify the email's existence.
    const { username } = req.query;
    const emailRecord = await typeToModel("user").findOne({ name: username });
    if (emailRecord === null) {
      return res
        .status(400)
        .send(
          generateEmailHtml(
            "Your account is not exist.",
            "Please register your account first."
          )
        );
    }

    await typeToModel("user").findOneAndUpdate(
      { name: username },
      { $set: { emailVerified: true } }
    );

    return res
      .status(200)
      .send(
        generateEmailHtml(
          "Thank you!",
          "Your email has been verified successfully."
        )
      );
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send(
        generateEmailHtml(
          "Oops. Something wrong.",
          "Falied to verify your email."
        )
      );
  }
};

module.exports = { register, verifyEmail };
