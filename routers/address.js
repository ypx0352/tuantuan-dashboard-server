const router = require("express").Router();
const {
  addAddress,
  getAllAddress,
  deleteAddress,
  updateAddress,
} = require("../controllers/address");
const authentication = require("../middleware/authentication");
const { userAuthorization } = require("../middleware/authorization");

router.post("/add", authentication, userAuthorization, addAddress);

router.get("/all_address", authentication, userAuthorization, getAllAddress);

router.delete("/delete", authentication, userAuthorization, deleteAddress);

router.put("/update", authentication, userAuthorization, updateAddress);

module.exports = router;
