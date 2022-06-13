const jwt = require("jsonwebtoken");
const { generalHandleWithoutTransaction } = require("../controllers/static");

const authentication = async (req, res, next) => {
  generalHandleWithoutTransaction(
    async () => {
      const header = req.headers["authorization"];
      if (typeof header !== "undefined") {
        const bearer = header.split(" ");
        const token = bearer[1];

        if (token === "null") {
          return res
            .status(401)
            .json({ msg: "Token missing. Please login again." });
        }
        const tokenPayload = await jwt.verify(token, process.env.JWT_KEY);
        const { name, role } = tokenPayload;
        req.body.username = name;
        req.body.userRole = role;

        //Generate and add a new token to responst header
        const nextToken = jwt.sign({ name, role }, process.env.JWT_KEY, {
          expiresIn: "1h", // 1 hour
        });
        res.setHeader("next-token", nextToken);
        res.setHeader("Access-Control-Expose-Headers", "next-token");
        next();
      } else {
        res.status(401).json({ msg: "Token missing. Please login again." });
      }
    },
    res,
    "Authentication failed. Server error."
  );
};

module.exports = authentication;
