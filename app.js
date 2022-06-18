const express = require("express");
const cors = require("cors");
require("dotenv").config();
const orderRouter = require("./routers/order");
const checkoutRouter = require("./routers/checkout");
const cartRouter = require("./routers/cart");
const settingRouter = require("./routers/setting");
const registerRouter = require("./routers/register");
const loginRouter = require("./routers/login");
const addressRouter = require("./routers/address");
const packageRouter = require("./routers/package");
const logRouter = require("./routers/log");
const transactionRouter = require("./routers/transaction");
const overviewRouter = require("./routers/overview");
const userRouter = require("./routers/user");
const resetPasswordRouter = require("./routers/resetPassword");

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/register", registerRouter);

app.use("/api/order", orderRouter);

app.use("/api/checkout", checkoutRouter);

app.use("/api/cart", cartRouter);

app.use("/api/setting", settingRouter);

app.use("/api/login", loginRouter);

app.use("/api/address", addressRouter);

app.use("/api/package", packageRouter);

app.use("/api/log", logRouter);

app.use("/api/transaction", transactionRouter);

app.use("/api/overview", overviewRouter);

app.use("/api/user", userRouter);

app.use("/api/reset_password", resetPasswordRouter);

app.listen(process.env.PORT || process.env.EXPRESS_PORT, () => {
  console.log("Server is running.");
});
