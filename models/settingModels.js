const connection = require("../database");
const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const SettingModel = connection.model("setting", settingSchema);

module.exports = SettingModel;
