const { generalHandleWithoutTransaction } = require("../controllers/static");

const userAndHigerRole = ["user", "admin"];
const adminRole = ["admin"];

const authorization = (validRoleList) => {
  return async (req, res, next) => {
    generalHandleWithoutTransaction(
      async () => {
        if (!validRoleList.includes(req.body.userRole)) {
          return res.status(403).json({
            msg: `As a ${req.body.userRole}, you do not have permission to perform this operation.`,
          });
        }
        next();
      },
      res,
      "Failed to verify your permission. Server error."
    );
  };
};

const userAuthorization = authorization(userAndHigerRole);
const adminAuthorization = authorization(adminRole);

module.exports = { userAuthorization, adminAuthorization };
