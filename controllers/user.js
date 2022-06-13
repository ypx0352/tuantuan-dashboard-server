const { generalHandleWithoutTransaction, typeToModel } = require("./static");

const getUserInfo = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { username } = req.body;
      const result = await typeToModel("user")
        .findOne({ name: username })
        .select("email name role active emailVerified createdAt -_id");
      res.status(200).json(result);
    },
    res,
    "Failed to get the user info. Server error."
  );
};

module.exports = { getUserInfo };
