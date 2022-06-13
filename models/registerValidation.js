const Joi = require("@hapi/joi");

const registerValidationSchema = {
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(9),
  registerCode: Joi.string().required(),
};

module.exports = registerValidationSchema;
