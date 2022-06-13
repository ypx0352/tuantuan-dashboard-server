const {
  generalHandleWithoutTransaction,
  typeToModel,
  generalHandle,
  writeLog,
} = require("./static");

const getSetting = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const result = await typeToModel("setting").find();
      return res.status(200).json({ result: result });
    },
    res,
    "Failed to get settings. Server error"
  );
};

const setSetting = async (req, res) => {
  generalHandle(async (session) => {
    const { name, value, username } = req.body;

    await typeToModel("setting").findOneAndUpdate(
      { name: name },
      { $set: { value: value } },
      { session: session }
    );
    // Write the log.
    const logResult = await writeLog(
      username,
      `Update setting ${name} to ${value}.`,
      "",
      session
    );
    if (logResult.insertedCount !== 1) {
      // If the writeLog function returns an error, rollback the transaction.
      throw new Error("Failed to write the log.");
    }

    return "Updated successfully!";
  }, res);
};

module.exports = { getSetting, setSetting };
