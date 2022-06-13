const mongoose = require("mongoose");

const connection = require("../database");

const emailValidater = (email) => {
  const re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: "Email address is required.",
      trim: true,
      lowercase: true,
      unique: [true, "User is already exist."],
      validate: [emailValidater, "Please fill a valid email address"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: [true, "User is already exist."],
    },
    password: {
      type: String,
      required: "Name is required.",
      minlength: [9, "Password must be at least 9 characters."],
    },
    role: {
      type: String,
      enum: ["admin", "user", "visitor"],
      required: [true, "Invalid user role."],
    },
    active: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    nextVerificationCode: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const UserModel = connection.model("user", userSchema);

module.exports = UserModel;
