const router = require("express").Router();
const {
  allItems,
  approveExceptionItem,
  updateNote,
  transferItem,
} = require("../controllers/checkout");
const authentication = require("../middleware/authentication");
const {
  adminAuthorization,
  userAuthorization,
} = require("../middleware/authorization");

router.get("/all_items", authentication, allItems);

router.put(
  "/approve_exception_item",
  authentication,
  adminAuthorization,
  approveExceptionItem
);

router.put("/update_note", authentication, userAuthorization, updateNote);

router.put("/transfer_item", authentication, userAuthorization, transferItem);

module.exports = router;
