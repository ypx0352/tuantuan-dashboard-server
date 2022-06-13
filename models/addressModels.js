const connection = require("../database");
const mongoose = require("mongoose");

// Define the schema of the address collection.
const addressSchema = new mongoose.Schema(
  {
    province: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    note: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

const AddressModel = connection.model("address", addressSchema);

module.exports = AddressModel;
