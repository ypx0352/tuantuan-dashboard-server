const {
  typeToModel,
  generalHandle,
  validateAndGetSourceRecord,
  generalHandleWithoutTransaction,
  calculateCost,
  calculateProfits,
  floatMultiply100ToInt,
  getSettingValuesOfOnePackage,
} = require("./static");

const calculatePayAmountToSender = (cost, profits) => {
  return (
    (floatMultiply100ToInt(cost) +
      floatMultiply100ToInt(floatMultiply100ToInt(profits) / 2) / 100) /
    100
  );
};

const getPackageType = async (pk_id) => {
  try {
    const result = await typeToModel("package").findOne({ pk_id: pk_id });
    if (result === null) {
      throw new Error("Failed to get the package type.");
    } else {
      return result.type;
    }
  } catch (error) {
    throw error;
  }
};

const addToCart = (req, res) => {
  generalHandle(async (session) => {
    const { addToCart, _id, type, username } = req.body;
    // Make sure the item exists in database and has sufficient qty. Get the record in database.
    const sourceRecordResult = await validateAndGetSourceRecord(
      type,
      _id,
      addToCart
    );
    if (sourceRecordResult.ok !== 1) {
      throw new Error(sourceRecordResult.msg);
    }

    const { price, weight, pk_id, note, item, receiver } =
      sourceRecordResult.sourceRecord;

    // Get the package type.
    const packageType = await getPackageType(pk_id);

    // Get setting values of this package
    const settingValues = await getSettingValuesOfOnePackage(pk_id);

    // Calculate the cost.
    const cost = await calculateCost(
      price,
      packageType,
      weight,
      addToCart,
      settingValues
    );

    //Calculate the profits and payAmountToSender, except for employee items.
    if (type !== "employee") {
      var { subtotal } = req.body;
      if (type === "exception") {
        subtotal = sourceRecordResult.sourceRecord.subtotal;
      }
      const profits = calculateProfits(subtotal, cost);
      const payAmountToSender = calculatePayAmountToSender(cost, profits);
      await typeToModel("cart").findOneAndUpdate(
        { username: username },
        {
          $push: {
            items: [
              {
                item,
                original_id: _id,
                cost,
                qty: addToCart,
                profits,
                payAmountFromCustomer: subtotal,
                payAmountToSender,
                originalType: type,
                receiver,
                pk_id,
                note,
              },
            ],
          },
        },
        { session: session, upsert: true }
      );
    } else {
      await typeToModel("cart").findOneAndUpdate(
        { username: username },
        {
          $push: {
            items: [
              {
                item,
                original_id: _id,
                cost,
                qty: addToCart,
                payAmountToSender: cost,
                originalType: type,
                receiver,
                pk_id,
                note,
              },
            ],
          },
        },
        { session: session, upsert: true }
      );
    }

    // Add the qty_in_cart of the item in the original collection
    await typeToModel(type).findByIdAndUpdate(_id, {
      $inc: { qty_in_cart: addToCart },
    });
    return `${addToCart} ${item} has been added to the cart successfully.`;
  }, res);
};

const setReturnAllProfitsItem = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { _id, returnAllProfits, username } = req.body;
      var payAmountToSender = null;
      const result = await typeToModel("cart").findOne({
        username: username,
      });
      const targetItem = result.items.filter((item) => item._id == _id)[0];
      if (targetItem === undefined) {
        throw new Error("Failed to find the item in database.");
      }

      if (["employee", "exception"].includes(targetItem.originalType)) {
        throw new Error(
          "Can not set returnAllProfits at employee or exception item."
        );
      }

      if (returnAllProfits) {
        payAmountToSender = targetItem.payAmountFromCustomer;
      } else {
        const cost = targetItem.cost;
        const profits = targetItem.profits;
        payAmountToSender = calculatePayAmountToSender(cost, profits);
      }

      await typeToModel("cart").findOneAndUpdate(
        {
          username: username,
          "items._id": _id,
        },
        {
          $set: {
            "items.$.returnAllProfits": returnAllProfits,
            "items.$.payAmountToSender": payAmountToSender,
          },
        }
      );

      res.status(200).json({
        msg: `Change to ${targetItem.qty} ${targetItem.item} has been applied.`,
      });
    },
    res,
    "Failed to set this item to return all profits item."
  );
};

const getCartItems = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const result = await typeToModel("cart").findOne({
        username: req.body.username,
      });
      if (result === null) {
        return res.status(200).json({ result: [] });
      } else {
        return res.status(200).json({ result: result.items });
      }
    },
    res,
    "Failed to load cart items. Server error!"
  );
};

const removeCartItem = async (req, res) => {
  generalHandle(async (session) => {
    const { record_id, solid_id, type, addToCart, username } = req.body;
    // Make sure the item exists in the original collection.
    const result = await typeToModel(type).findById(solid_id);
    if (result === null) {
      throw new Error("The item does not exist.");
    }

    // Update the item's qty_in_cart.
    await typeToModel(type).findByIdAndUpdate(
      solid_id,
      {
        $inc: { qty_in_cart: -addToCart },
      },
      { session: session }
    );

    // Remove the item from cart collection.
    await typeToModel("cart").findOneAndUpdate(
      { username: username },
      { $pull: { items: { _id: record_id } } },
      { session: session }
    );

    return "Item has been removed from cart successfully";
  }, res);
};

module.exports = {
  addToCart,
  getCartItems,
  removeCartItem,
  setReturnAllProfitsItem,
};
