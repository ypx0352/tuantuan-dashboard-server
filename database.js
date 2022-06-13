const mongoose = require("mongoose");

const connection = mongoose.createConnection(process.env.DB_URL);

module.exports = connection;
