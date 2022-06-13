const {
  writeLog,
  generalHandle,
  typeToModel,
  generalHandleWithoutTransaction,
  getOrderModels,
  removeItemFromCollection,
} = require("./static");

const allItems = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const allItems = [];
      for (const model of getOrderModels()) {
        const result = await model.find();
        allItems.push(result);
      }
      const [soldItems, stockItems, employeeItems, exceptionItems] = allItems;
      res.status(200).json({
        result: { soldItems, stockItems, employeeItems, exceptionItems },
      });
    },
    res,
    "Can not get all items. Server error."
  );
};

const approveExceptionItem = (req, res) => {
  generalHandle(async (session) => {
    // Validate and get the source record.
    const sourceRecordResult = await validateAndGetSourceRecord(
      "exception",
      req.body._id,
      1
    );
    if (sourceRecordResult.ok !== 1) {
      throw new Error(sourceRecordResult.msg);
    }

    // Manipulate the record in the exception collection.
    const result = await typeToModel("exception").findByIdAndUpdate(
      req.body._id,
      {
        $set: {
          approved: true,
        },
      },
      { new: true, session: session }
    );

    // If the modification is failed, rollback the transaction.
    if (!result.approved) {
      throw new Error("Failed to approve this item. Server error.");
    }

    // Logging this action.
    const logResult = await writeLog(
      req.body.username,
      `Approve exception ${sourceRecordResult.sourceRecord.qty} ${sourceRecordResult.sourceRecord.item}.`,
      sourceRecordResult.sourceRecord.pk_id,
      session
    );

    // If the writeLog function returns an error, rollback the transaction.
    if (logResult.insertedCount !== 1) {
      throw new Error("Failed to write the log.");
    }

    // If there is no error, return the success response text.
    return `Successfully approve ${sourceRecordResult.sourceRecord.qty} ${sourceRecordResult.sourceRecord.item}.`;
  }, res);
};

const updateNote = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { newNote, type, _id } = req.body;
      await typeToModel(type).findByIdAndUpdate(_id, {
        $set: { note: newNote },
      });
      res.status(200).json({ msg: "Note has been updated successfully." });
    },
    res,
    "Failed to update the note. Server error."
  );
};

const transferItem = (req, res) => {
  generalHandle(async (session) => {
    const {
      original_id,
      sourceType,
      targetType,
      transferQty,
      subtotal,
      username,
    } = req.body;

    // Validate and get the source record.
    const sourceRecordResult = await validateAndGetSourceRecord(
      sourceType,
      original_id,
      transferQty
    );
    if (sourceRecordResult.ok !== 1) {
      throw new Error(sourceRecordResult.msg);
    }

    // Manipulate the record in the source collection.
    const removeResult = await removeItemFromCollection(
      sourceType,
      sourceRecordResult.sourceRecord,
      transferQty,
      0,
      session
    );
    if (removeResult.ok !== 1) {
      // If the removeItemFromCollection function returns an error, rollback the transaction.
      throw new Error("Failed to manipulate the original record.");
    }

    // Manipulate the record in the target collection.
    const addResult = await addItemToCollection(
      targetType,
      sourceRecordResult.sourceRecord,
      transferQty,
      subtotal,
      session
    );
    if (addResult.ok !== 1) {
      // If the addItemToCollection function returns an error, rollback the transaction.
      throw new Error("Failed to manipulate the target record.");
    }

    // Write the log.
    const logResult = await writeLog(
      username,
      `Transfer ${transferQty} ${sourceRecordResult.sourceRecord.item} to ${targetType} from ${sourceType}.`,
      sourceRecordResult.sourceRecord.pk_id,
      session
    );
    if (logResult.insertedCount !== 1) {
      // If the writeLog function returns an error, rollback the transaction.
      throw new Error("Failed to write the log.");
    }

    // If there is no error, return the success response text.
    return `Successfully transferred ${transferQty} ${sourceRecordResult.sourceRecord.item} to ${targetType} from ${sourceType}.`;
  }, res);
};

const addItemToCollection = async (
  collectionType,
  item,
  addQty,
  subtotal,
  session
) => {
  try {
    // Create a new record or update the record in the target collection depending on whether there is a same item saved in the target collection. Same items have the same pk_id, item, cost and price (and payAmountEach in exception collection).
    const model = typeToModel(collectionType);

    var payAmountEach;

    if (collectionType === "exception") {
      payAmountEach = Number(((subtotal * 100) / addQty / 100).toFixed(2));
    }

    const filter =
      collectionType === "exception"
        ? {
            pk_id: item.pk_id,
            item: item.item,
            cost: item.cost,
            price: item.price,
            payAmountEach: payAmountEach,
          }
        : {
            pk_id: item.pk_id,
            item: item.item,
            cost: item.cost,
            price: item.price,
          };

    const update =
      collectionType === "exception"
        ? {
            $set: {
              original_id: item._id,
              weight: item.weight,
              note: item.note,
              exchangeRate: item.exchangeRate,
              type: collectionType,
              originalType: item.type,
              payAmountEach: payAmountEach,
              price: item.price,
              subtotal: subtotal,
              approved: false,
              receiver: item.receiver,
              sendTimeISO: item.sendTimeISO,
              updatedAt: new Date(),
            },
            $inc: { qty: addQty, qty_in_cart: 0, payAmount: subtotal },
          }
        : {
            $set: {
              weight: item.weight,
              note: item.note,
              exchangeRate: item.exchangeRate,
              receiver: item.receiver,
              sendTimeISO: item.sendTimeISO,
              type: collectionType,
              updatedAt: new Date(),
            },
            $inc: { qty: addQty, qty_in_cart: 0 },
          };

    const result = await model.findOneAndUpdate(filter, update, {
      upsert: true,
      rawResult: true,
      timestamps: true,
      session: session,
    });
    return result;
  } catch (error) {
    throw error;
  }
};

const validateAndGetSourceRecord = async (sourceType, item_id, transferQty) => {
  try {
    // Make sure the item exists in the database.
    const model = typeToModel(sourceType);
    const sourceRecord = await model.findById(item_id);
    if (sourceRecord === null) {
      return {
        ok: 0,
        msg: `Failed. Can not find the item in the ${sourceType} collection or there are not sufficient items for this action.`,
      };
    }

    // Make sure the item has enough quantity to transfer.
    if (sourceRecord.qty - sourceRecord.qty_in_cart < transferQty) {
      return {
        ok: 0,
        msg: `Failed. The item has only ${sourceRecord.qty_available} quantity available.`,
      };
    }

    return { ok: 1, sourceRecord };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  allItems,
  approveExceptionItem,
  updateNote,
  transferItem,
};
