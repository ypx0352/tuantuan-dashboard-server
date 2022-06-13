const connection = require("../database");
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    //original_id: { type: String, required: true },
    cost: { type: Number, required: true }, //total cost
    qty: { type: Number, required: true },
    profits: { type: Number }, //total profits
    payAmountFromCustomer: { type: Number }, // total money received from customers
    payAmountToSender: { type: Number, required: true }, //total money pay back to the sender
    originalType: { type: String, required: true },
    type: { type: String, default: "transaction" },
    receiver: { type: String, required: true },
    pk_id: { type: String, required: true },
    note: { type: String, default: "" },
    returnAllProfits: { type: Boolean, required: true, default: false },
    price: { type: Number, required: true }, // price per unit
    weight: { type: Number, required: true }, // weight per unit
  },
  { timestamps: true }
);

const transactionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    items: [itemSchema],
    approved: { type: Boolean, default: false },
    payAmountToSender: { type: Number, required: true },
    qty: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
  },
  { timestamps: true }
);

const TransactionModel = connection.model("transaction", transactionSchema);

module.exports = TransactionModel;
