const Joi = require("@hapi/joi");

const registerValidationSchema = {
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(9),
  registerCode: Joi.string().required(),
};

const loginValidationSchema = {
  email: Joi.string().email().required(),
  password: Joi.string().required(),
};

const resetPasswordValidationSchema = {
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(9),
  code: Joi.string().length(6).required(),
};

const sendVerificationCodeValidationSchema = {
  name: Joi.string().required(),
  email: Joi.string().email().required(),
};

// Validate  input
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = Joi.object(schema).validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errorObject = {};
      const errorList = error.details;
      errorList.forEach((error) => {
        errorObject[error.path] = error.message;
      });
      return res
        .status(400)
        .json({ errorObject, msg: "Please check your input." });
    }
    next();
  };
};

const loginValidation = validateInput(loginValidationSchema);
const registerValidation = validateInput(registerValidationSchema);
const resetPasswordValidation = validateInput(resetPasswordValidationSchema);
const sendVerificationCodeValidation = validateInput(
  sendVerificationCodeValidationSchema
);

module.exports = {
  loginValidation,
  registerValidation,
  resetPasswordValidation,
  sendVerificationCodeValidation,
};
