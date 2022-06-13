const mongoose = require("mongoose");
const connection = require("../database");

const logSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    user: { type: String, required: true },
    id: { type: String },
  },
  { timestamps: true }
);

const LogModel = connection.model("log", logSchema);

module.exports = LogModel;
