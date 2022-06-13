const { typeToModel, generalHandleWithoutTransaction } = require("./static");

const getTodos = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const pendingTransaction = { type: "transaction" };
      const pendingException = { type: "exception" };
      const stockItem = { type: "stock" };
      const sold = { type: "sold" };
      const employee = { type: "employee" };

      const pendingCount = async (type) =>
        await typeToModel(type).count({ approved: false });

      const qtyCount = async (type) => {
        const aggregation = await typeToModel(type).aggregate([
          { $group: { _id: null, amount: { $sum: "$qty" } } },
        ]);
        const count = aggregation.length === 0 ? 0 : aggregation[0].amount;
        return count;
      };

      for (const item of [pendingTransaction, pendingException]) {
        const count = await pendingCount(item.type);
        item.count = count;
        delete item.type;
      }

      for (const item of [stockItem, sold, employee]) {
        const count = await qtyCount(item.type);
        item.count = count;
        delete item.type;
      }

      const newItem = { count: sold.count + employee.count };

      return res
        .status(200)
        .json({ pendingTransaction, pendingException, stockItem, newItem });
    },
    res,
    "Failed to get todos data. Server error."
  );
};

module.exports = { getTodos };
