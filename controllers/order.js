const cheerio = require("cheerio");
const FormData = require("form-data");
const axios = require("axios");
const {
  trackParcel,
  getOrderModels,
  generalHandle,
  generalHandleWithoutTransaction,
  writeLog,
  getSettingValues,
  login,
} = require("./static");

const PackageModel = require("../models/packageModel");

let mtoken = "";

// search for a specific package
const getOnePackage = async (pk_id) => {
  try {
    console.log("search one package...");
    var packageSearchData = new FormData();
    packageSearchData.append("per_page", "1");
    packageSearchData.append("page_num", "10");
    packageSearchData.append("msearch_text[idnum]", pk_id);
    const response = await axios({
      method: "post",
      url: process.env.POLAR_PACKAGE_LIST_URL,
      data: packageSearchData,
      headers: packageSearchData.getHeaders({
        mtoken: mtoken,
      }),
    });

    // check if the response is correct
    if (response.data.msg === "未登录") {
      return "need to login";
    } else if (response.data.msg !== "success") {
      console.log("Post says:", response.data.msg);
      return "false";
    } else if (response.data.data.list.length === 0) {
      return "not found";
    } else {
      return parseResponse(response.data);
    }
  } catch (error) {
    throw error;
  }
};

const parseResponse = (data) => {
  const package_msg = {};
  // package_id
  package_msg.package_id = data.data.list[0].pkg_sn;

  // weight
  package_msg.package_weight = data.data.list[0].weight;

  // receiver name and phone
  package_msg.receiver_name = data.data.list[0].receive_name;
  package_msg.receiver_phone = data.data.list[0].receive_mobile;

  // reveiver address
  const {
    receive_province_remark,
    receive_city_remark,
    receive_area_remark,
    receive_adrs,
  } = data.data.list[0];

  package_msg.receiver_address =
    receive_province_remark +
    receive_city_remark +
    receive_area_remark +
    receive_adrs;

  // amount
  package_msg.item_count = data.data.list[0].pkg_nums;

  // type
  package_msg.item_type = data.data.list[0].rate_type;

  // items
  package_msg.items = data.data.list[0].pkg_info_cn;
  return package_msg;
};

const checkOrderExist = async (pk_id) => {
  try {
    const result = await PackageModel.findOne({ pk_id: pk_id });
    if (result === null) {
      return false;
    }
    return true;
  } catch (error) {
    throw error;
  }
};

const getOrder = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      const { pk_id } = req.params;
      var result = {};
      // Check whether the order is exist in package collection.
      if (await checkOrderExist(pk_id)) {
        return res.status(200).json({ exist: true });
      }

      // When mtoken is not null, try to get package message, otherwise try to relogin
      if (mtoken !== "") {
        result = await getOnePackage(pk_id);
      } else {
        mtoken = await login();
        result = await getOnePackage(pk_id);
      }

      for (let index = 0; index <= 3; index++) {
        switch (result) {
          case "false":
            return res.status(500).json({ msg: "Bad request to post." });

          case "not found":
            return res
              .status(400)
              .json({ msg: "Package not found, please check your input!" });

          // Try to login again when token expire
          case "need to login":
            if (index !== 3) {
              console.log("relogin...");
              mtoken = await login();
              result = await getOnePackage(pk_id);
            } else {
              return res
                .status(500)
                .json({ msg: "Can not login with post credentials" });
            }
            break;

          default:
            const sendTimeISO = await trackParcel(pk_id, "sendTime");
            result.sendTimeISO = sendTimeISO;
            return res.status(200).json({ exist: false, result: result });
        }
      }
    },
    res,
    "Can not find the package. Server error."
  );
};

const getExchangeRate = async (req, res) => {
  generalHandleWithoutTransaction(
    async () => {
      // Request html from the bank
      const response = await axios.get("https://www.boc.cn/sourcedb/whpj/");

      // Parse html
      const $ = cheerio.load(response.data);
      const exchangeRate = $("tr").eq(3).children().eq(3).text();
      res.status(200).json({ result: exchangeRate });
    },
    res,
    "Can not get the exchange rate. Server error."
  );
};

const submitOrder = async (req, res) => {
  generalHandle(async (session) => {
    const { pk_id, stock, employee, sold } = req.body.reviewData;
    const { packageData, receiverData, username } = req.body;

    // To avoid duplicate saves, check duplicates first.
    models = getOrderModels().concat(PackageModel);

    for (const model of models) {
      const result = await model.findOne({ pk_id });
      if (result !== null) {
        return res.status(400).json({
          msg: "Failed! This package has already been saved! ",
        });
      }
    }

    // Insert data to three of order collections
    const itemsCollections = [sold, stock, employee];
    const types = ["Sold", "Stock", "Employee"];
    for (let index = 0; index < itemsCollections.length; index++) {
      const itemCollection = itemsCollections[index];
      if (itemCollection.length > 0) {
        const saveOrderResult = await getOrderModels()[index].insertMany(
          itemCollection.map((item) => {
            delete item.key;
            return item;
          }),
          { session: session, rawResult: true }
        );
        if (saveOrderResult.insertedCount !== itemCollection.length) {
          throw new Error(`Failed to save ${types[index]} items.`);
        }
      }
    }

    //Add settings value and save package information to package collection.
    delete packageData.key;
    delete receiverData.key;
    const settingValues = await getSettingValues();
    [
      packageData.exchangeRate,
      packageData.normalPostage,
      packageData.babyFormulaPostage,
    ] = [
      settingValues.exchangeRate,
      settingValues.normalPostage,
      settingValues.babyFormulaPostage,
    ];

    await PackageModel.create([Object.assign(packageData, receiverData)], {
      session: session,
    });

    // Write log.
    const logResult = await writeLog(
      username,
      `Create order ${pk_id}. `,
      pk_id,
      session
    );
    if (logResult.insertedCount !== 1) {
      throw new Error("Failed to write the log.");
    }

    return "The order has been saved to database successfully!";
  }, res);
};

module.exports = { getOrder, getExchangeRate, submitOrder };
