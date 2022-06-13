const AddressModel = require("../models/addressModels");
const { generalHandleWithoutTransaction } = require("./static");

const addAddress = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      await AddressModel.create(req.body);
      return res.status(200).json({
        msg: `${req.body.name}'s address has been saved successfully.`,
      });
    },
    res,
    "Failed to add new address. Server error."
  );
};

const getAllAddress = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const result = await AddressModel.find().sort({ createdAt: -1 });
      return res.status(200).json({ result });
    },
    res,
    "Failed to get all address. Server error."
  );
};

const deleteAddress = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      await AddressModel.findByIdAndRemove(req.body._id);
      return res
        .status(200)
        .json({ msg: "Address has been deleted successfully." });
    },
    res,
    "Failed to delete this address. Server error."
  );
};

const updateAddress = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { name, phone, province, city, district, address, note, _id } =
        req.body;
      await AddressModel.findByIdAndUpdate(_id, {
        $set: { name, phone, province, city, district, address, note },
      });
      return res.status(200).json({
        msg: `${name}'s address has been updated successfully.`,
      });
    },
    res,
    "Failed to update this address. Server error."
  );
};

module.exports = { addAddress, getAllAddress, deleteAddress, updateAddress };
