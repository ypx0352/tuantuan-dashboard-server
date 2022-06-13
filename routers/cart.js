const router = require("express").Router();
const {
  addToCart,
  getCartItems,
  removeCartItem,
  setReturnAllProfitsItem,
} = require("../controllers/cart");
const authentication = require("../middleware/authentication");
const { userAuthorization } = require("../middleware/authorization");

router.post("/add_to_cart", authentication, userAuthorization, addToCart);

router.get("/items", authentication, getCartItems);

router.put("/remove_item", authentication, userAuthorization, removeCartItem);

router.put(
  "/set_return_all_profits_item",
  authentication,
  userAuthorization,
  setReturnAllProfitsItem
);

module.exports = router;
