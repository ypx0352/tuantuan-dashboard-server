const axios = require("axios");
const PdfPrinter = require("pdfmake");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const bigDecimal = require("js-big-decimal");
const connection = require("../database");
const LogModel = require("../models/logModel");
const AddressModel = require("../models/addressModels");
const CartModel = require("../models/cartModels");
const PackageModel = require("../models/packageModel");
const SettingModel = require("../models/settingModels");
const UserModel = require("../models/userModel");
const {
  SoldItemsModel,
  StockItemsModel,
  EmployeeItemsModel,
  ExceptionItemModel,
} = require("../models/orderModels");
const TransactionModel = require("../models/transactionModel");

const writeLog = async (user, action, id, session) => {
  try {
    const result = await LogModel.insertMany(
      [
        {
          user: user,
          action: action,
          id: id,
        },
      ],
      { session: session, rawResult: true }
    );
    return result;
  } catch (error) {
    throw error;
  }
};

const generalHandle = async (action, res) => {
  const session = await connection.startSession();
  try {
    session.startTransaction();
    const successResponseText = await action(session);
    await session.commitTransaction();
    res.status(200).json({ msg: successResponseText });
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    res.status(500).json({
      msg: "Failed. Server error!",
    });
  }
  session.endSession();
};

const generalHandleWithoutTransaction = async (action, res, errorMsg) => {
  try {
    await action();
  } catch (error) {
    console.log(error);
    if (error.message === "jwt expired") {
      return res
        .status(401)
        .json({ msg: "Token expires. Please login again." });
    }
    res.status(500).json({ msg: errorMsg });
  }
};

const trackParcel = async (pk_id, returnContent) => {
  try {
    var bodyFormData = new FormData();
    bodyFormData.append("source_sn[0]", pk_id);
    bodyFormData.append("token", process.env.POLAR_TRACK_PARCEL_TOKEN);
    const response = await axios({
      method: "post",
      url: process.env.PLOAR_TRACK_PARCEL_URL,
      data: bodyFormData,
      headers: bodyFormData.getHeaders(),
    });
    if (response.data.msg !== "success") {
      throw response.data.msg;
    } else {
      return parseParcelResponse(response.data, returnContent);
    }
  } catch (error) {
    throw error;
  }
};

const parseParcelResponse = (data, returnContent) => {
  try {
    if (returnContent === "sendTime") {
      return data.data[0].tklist[0].time;
    } else if (returnContent === "sendTimeAndTrack") {
      const trackInfo = data.data[0].tklist.map((item) => ({
        time: item.time,
        message: item.record,
      }));
      const domesticCourier = data.data[0].trans_cpy;
      const domesticParcelID = data.data[0].trans_num;
      const status = data.data[0].status_ex;
      return { trackInfo, domesticCourier, domesticParcelID, status };
    }
  } catch (error) {
    throw error;
  }
};

const updateNote = async (req, res) => {
  const { newNote, type, _id } = req.body;

  // Make sure the item exists in the database.
  try {
    const originalRecord = await typeToModel(type).findById(_id);
    if (originalRecord === null) {
      return res.status(400).json({
        msg: "Failed to update the note. Can not find the record in the database.",
      });
    }

    // Update the note.
    await typeToModel(type).findByIdAndUpdate(_id, { $set: { note: newNote } });
    res.status(200).json({ msg: "Note has been updated successfully." });
  } catch (error) {
    console.log("Failed to update the note. Server error.");
    throw error;
  }
};

const typeToModel = (type) => {
  const modelsMap = {
    sold: SoldItemsModel,
    stock: StockItemsModel,
    employee: EmployeeItemsModel,
    exception: ExceptionItemModel,
    address: AddressModel,
    cart: CartModel,
    log: LogModel,
    package: PackageModel,
    setting: SettingModel,
    user: UserModel,
    transaction: TransactionModel,
  };
  return modelsMap[type];
};

const getOrderModels = () => {
  return [
    SoldItemsModel,
    StockItemsModel,
    EmployeeItemsModel,
    ExceptionItemModel,
  ];
};

const getSettingValues = async () => {
  try {
    const [normalPostageResult, babyFormulaPostageResult, exchangeRateResult] =
      await typeToModel("setting").find();
    return {
      normalPostage: normalPostageResult.value,
      babyFormulaPostage: babyFormulaPostageResult.value,
      exchangeRate: exchangeRateResult.value,
    };
  } catch (error) {
    throw error;
  }
};

const getSettingValuesOfOnePackage = async (pk_id) => {
  try {
    const result = await typeToModel("package").findOne({ pk_id, pk_id });
    return {
      exchangeRate: result.exchangeRate,
      normalPostage: result.normalPostage,
      babyFormulaPostage: result.babyFormulaPostage,
    };
  } catch (error) {
    throw error;
  }
};

const calculatePostageInRMB = async (type, weightEach, qty, settingValues) => {
  try {
    const { normalPostage, babyFormulaPostage, exchangeRate } = settingValues;
    if (type === "非奶粉") {
      return (
        floatMultiply100ToInt(
          (floatMultiply100ToInt(normalPostage) *
            floatMultiply100ToInt(weightEach) *
            floatMultiply100ToInt(exchangeRate) *
            qty) /
            1000000
        ) / 100
      );
    } else if (type === "奶粉") {
      // The return value is not rounded.
      return (
        floatMultiply100ToInt(
          (floatMultiply100ToInt(
            floatMultiply100ToInt(babyFormulaPostage) / 3
          ) *
            floatMultiply100ToInt(exchangeRate) *
            qty) /
            1000000
        ) / 100
      );
    }
  } catch (error) {
    throw error;
  }
};

const calculateItemCostInRMB = async (pharmacyPriceEach, qty, exchangeRate) => {
  try {
    return (
      floatMultiply100ToInt(
        (floatMultiply100ToInt(pharmacyPriceEach) *
          qty *
          floatMultiply100ToInt(exchangeRate)) /
          10000
      ) / 100
    );
  } catch (error) {
    throw error;
  }
};

const calculateCost = async (
  pharmacyPriceEach,
  type,
  weightEach,
  qty,
  settingValues
) => {
  try {
    const { exchangeRate } = settingValues;
    const postage = await calculatePostageInRMB(
      type,
      weightEach,
      qty,
      settingValues
    );

    const itemCost = await calculateItemCostInRMB(
      pharmacyPriceEach,
      qty,
      exchangeRate
    );
    const cost =
      floatMultiply100ToInt(
        (floatMultiply100ToInt(postage) + floatMultiply100ToInt(itemCost)) / 100
      ) / 100;
    return cost;
  } catch (error) {
    throw error;
  }
};

const calculateProfits = (payAmountFromCustomer, cost) => {
  const profits =
    floatMultiply100ToInt(
      (floatMultiply100ToInt(payAmountFromCustomer) -
        floatMultiply100ToInt(cost)) /
        100
    ) / 100;
  return profits;
};

const floatMultiply100ToInt = (float) => {
  return Number((float * 100).toFixed(0));
};

const validateAndGetSourceRecord = async (sourceType, item_id, transferQty) => {
  try {
    // Make sure the item exists in the database.
    const model = typeToModel(sourceType);
    const sourceRecord = await model.findById(item_id);
    if (sourceRecord === null) {
      return {
        ok: 0,
        msg: `Failed. Can not find the item in the ${sourceType} collection. `,
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

const removeItemFromCollection = async (
  collectionType,
  originalRecord,
  removeQty,
  removeQtyInCart,
  session
) => {
  try {
    const model = typeToModel(collectionType);

    // If the new qty does not becomes 0, update the qty.
    if (originalRecord.qty - removeQty !== 0) {
      const result = await model.findByIdAndUpdate(
        originalRecord._id,
        {
          $inc: { qty: -removeQty, qty_in_cart: -removeQtyInCart },
        },
        { rawResult: true, session: session }
      );
      return result;
    }
    // If the qty in the original collection becomes 0 after updating, delete the record in the original collection.
    else {
      const result = await model.findByIdAndDelete(originalRecord._id, {
        rawResult: true,
        session: session,
      });
      return result;
    }
  } catch (error) {
    throw error;
  }
};

const login = async () => {
  try {
    console.log("Login...");
    var bodyFormData = new FormData();
    bodyFormData.append("username", process.env.EMAIL);
    bodyFormData.append("password", process.env.PASSWORD);

    const response = await axios({
      method: "post",
      url: process.env.POLAR_LOGIN_URL,
      data: bodyFormData,
      headers: bodyFormData.getHeaders(),
    });
    mtoken = response.data.data.mtoken;
    return mtoken;
  } catch (error) {
    throw error;
  }
};

const generateInvoicePdf = (record) => {
  try {
    const generateDetailTableBody = (record) => {
      // Generate table rows.
      const bodyList = record.items.map((item) => [
        item.item,
        item.qty,
        item.originalType,
        "￥" + prettifyMoneyNumber(item.cost),
        item.profits === undefined
          ? "————"
          : "￥" + prettifyMoneyNumber(item.profits),
        "$" + prettifyMoneyNumber(item.price),
        item.weight + "Kg",
        item.pk_id,
        item.receiver,
        item.returnAllProfits ? "Yes" : "No",
        item.payAmountFromCustomer === undefined
          ? "—————"
          : "￥" + prettifyMoneyNumber(item.payAmountFromCustomer),
        "￥" + prettifyMoneyNumber(item.payAmountToSender),
        item.note + " ",
      ]);

      // Add table header to the beginning of body list
      bodyList.unshift([
        "Item",
        "Qty",
        "Type",
        "Cost",
        "Profits",
        "Price each",
        "Weight each",
        "Package ID",
        "Receiver",
        "All profits",
        "Customer pay",
        "Pay sender",
        "Note",
      ]);
      return bodyList;
    };

    const generateOverviewTableBody = (record) => [
      ["Time", "Transaction ID", "User", "Qty", "Subtotal", "Payment method"],
      [
        new Date().toLocaleString(),
        record._id.toString(),
        record.username,
        record.qty,
        "￥" + prettifyMoneyNumber(record.payAmountToSender),
        record.paymentMethod,
      ],
    ];

    generateOverviewTableBody(record);

    const fonts = {
      Pingfang: {
        normal: path.resolve(
          __dirname,
          "../public/font/PingFang SC Regular.ttf"
        ),
      },
    };

    const printer = new PdfPrinter(fonts);

    const docDefinition = {
      // PDF content.
      content: [
        {
          image: path.resolve(
            __dirname,
            "../public/image/dashboard-logo-removebg.png"
          ),
          width: 50,
          style: "image",
        },
        { text: "Invoice", style: "header" },

        // Transaction overview table.
        {
          style: "overviewTable",
          table: {
            headerRows: 1,
            body: generateOverviewTableBody(record),
          },
          layout: "headerLineOnly",
        },

        // Transaction detail table
        {
          style: "detailTable",
          table: {
            headerRows: 1,
            body: generateDetailTableBody(record),
          },
        },

        {
          text: "----------This is the end of the invoice.----------",
          alignment: "center",
          fontSize: 8,
        },
      ],

      footer: (currentPage, pageCount) => {
        return {
          text: currentPage.toString() + " of " + pageCount,
          alignment: "center",
        };
      },

      styles: {
        header: {
          fontSize: 18,
          margin: [0, 0, 0, 10],
          alignment: "center",
        },
        detailTable: {
          margin: [0, 0, 0, 15],
          fontSize: 9,
        },
        overviewTable: {
          margin: [0, 0, 0, 15],
          fontSize: 10,
        },
        image: {
          alignment: "center",
        },
      },

      defaultStyle: {
        font: "Pingfang",
      },

      // PDF page settings.
      pageOrientation: "landscape",
      pageSize: "A4",

      //PDF meta data.
      info: {
        title: "Tuantuan dashboard invoice",
        author: "Tuantuan dashboard",
        subject: "Invoice",
        producer: "Tuantuan dashboard",
        creator: "Tuantuan dashboard",
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(
      fs.createWriteStream(
        path.resolve(
          __dirname,
          `../public/pdf/Invoice-${record._id.toString()}.pdf`
        )
      )
    );
    pdfDoc.end();
  } catch (error) {
    throw error;
  }
};

const prettifyMoneyNumber = (value) => {
  try {
    return new bigDecimal(value.toFixed(2)).getPrettyValue();
  } catch (error) {
    throw error;
  }
};

const sendEmail = async (emailAddress, subject, content, attachment) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SENDER_USER,
        pass: process.env.EMAIL_SENDER_PASS,
      },
    });

    const mailOptions =
      attachment === undefined
        ? {
            from: process.env.EMAIL_SENDER_USER,
            to: emailAddress,
            subject: subject,
            html: content,
          }
        : {
            from: process.env.EMAIL_SENDER_USER,
            to: emailAddress,
            subject: subject,
            html: content,
            attachments: [
              {
                filename: path.basename(attachment),
                path: attachment,
                contentType: "application/pdf",
              },
            ],
          };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
};

const generateEmailHtml = (
  title,
  content
) => `<div style="padding: 20px; width: 100%; margin: 0 auto">
      <div style="width: 600px; margin: 20px auto">
        <img
          src="https://github.com/ypx0352/ypx0352.github.io/blob/main/tuantuanDashboard-emailPic/dashboard-logo-removebg-preview.png?raw=true"
          style="
            width: 150px;
            display: block;
            margin-left: auto;
            margin-right: auto;
          "
        />
        <img
          src="https://github.com/ypx0352/ypx0352.github.io/blob/main/tuantuanDashboard-emailPic/email-banner-removebg-preview.png?raw=true"
          style="
            display: block;
            margin-left: auto;
            margin-right: auto;
            width: 100%;
          "
        />
        <div
          style="
            padding: 10px;
            margin: auto;
            border-radius: 10px;
            width: 400px;
            background-color: #d7f2fb;
          "
        >
          <h2 style="text-align: center">${title}</h2>
          <p style="text-align: center">
            ${content}
          </p>
        </div>
      </div>
    </div>`;

module.exports = {
  writeLog,
  generalHandle,
  trackParcel,
  updateNote,
  typeToModel,
  getOrderModels,
  generalHandleWithoutTransaction,
  validateAndGetSourceRecord,
  getSettingValues,
  calculateCost,
  calculateProfits,
  floatMultiply100ToInt,
  getSettingValuesOfOnePackage,
  addItemToCollection,
  removeItemFromCollection,
  login,
  generateInvoicePdf,
  prettifyMoneyNumber,
  sendEmail,
  generateEmailHtml,
};
