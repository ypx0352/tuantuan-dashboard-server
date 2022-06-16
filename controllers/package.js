const axios = require("axios");
const { DateTime } = require("luxon");

const {
  trackParcel,
  getOrderModels,
  generalHandleWithoutTransaction,
  typeToModel,
  login,
} = require("./static");
let mtoken = "1";

const getSearchedPackage = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { pk_id } = req.query;
      const trackRecords = await trackParcel(pk_id, "sendTimeAndTrack");

      // Get items not yet paid (items in Sold, Stock, Employee, Exception collections)
      var itemRecords = [];
      for (const model of getOrderModels()) {
        const result = await model.find({ pk_id: pk_id });
        result.forEach((item) => itemRecords.push(item));
      }

      //Get paid items (items in the Transaction collection)
      const transactionResult = await typeToModel("transaction").find({
        "items.pk_id": pk_id,
      });

      transactionResult.forEach((transaction) => {
        var transactionObj = transaction.toObject();
        const approved = transactionObj.approved;
        const transaction_id = transactionObj._id;
        transactionObj.items.forEach((item) => {
          if (item.pk_id === pk_id) {
            // Add transaction_id, transactionApproved and type property in transaction items
            item.transaction_id = transaction_id;
            item.type = item.originalType;
            item.transactionApproved = approved;
            itemRecords.push(item);
          }
        });
      });

      const packageRecord = await typeToModel("package").findOne({
        pk_id: pk_id,
      });

      if (packageRecord === null && itemRecords.length === 0) {
        return res.status(400).json({
          msg: "Can not find this package in the database. Check your input.",
        });
      }
      res.status(200).json({ itemRecords, packageRecord, trackRecords });
    },
    res,
    "Failed to search this package. Server error."
  );
};

const getLatestPackages = (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { limit } = req.query;
      const rawResult = await typeToModel("package")
        .find()
        .sort("-createdAt")
        .limit(Number(limit));
      const result = rawResult.map((item) => {
        const { pk_id, type, receiver, sendTimeISO, ...rest } = item;
        const timeInISO = new Date(sendTimeISO).toISOString();
        const sendDateInADL = DateTime.fromISO(timeInISO)
          .setZone("Australia/Adelaide")
          .toFormat("MM-dd");
        return { pk_id, type, receiver, sendDateInADL };
      });
      res.status(200).json({ result });
    },
    res,
    "Failed to get the latest packages. Server error."
  );
};

const getPostSlip = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { pk_id } = req.query;
      const slicedPk_id = pk_id.slice(2, -2);
      res.setHeader("Content-Type", "application/pdf");
      const tokenValid = async () => {
        var pdf = await axios.get(
          `${process.env.PLOAR_POST_SLIP_BASE_URL}?pkg_id=${slicedPk_id}&mtoken=${mtoken}`,
          { responseType: "arraybuffer" }
        );
        // Check the token is valid
        if (pdf.data.length < 100) {
          return "false";
        } else {
          return res.status(200).send(pdf.data);
        }
      };

      if (mtoken !== "") {
        // If token is invalid relogin and try again.
        if ((await tokenValid()) === "false") {
          mtoken = await login();
          if ((await tokenValid()) === "false") {
            throw new Error("Token is invalid.");
          }
        }
      } else {
        mtoken = await login();
        await tokenValid();
      }
    },
    res,
    "Failed to get post slip. Server error."
  );
};

module.exports = { getSearchedPackage, getLatestPackages, getPostSlip };
