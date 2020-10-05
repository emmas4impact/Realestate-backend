const express = require("express");
const listEndpoints = require("express-list-endpoints");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const {
    join
} = require("path");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const listingsRoute = require("./Listings/list");
const tenantRoute = require("./Tenants/index");
const userRoute = require("./users/index");

const {
    notFoundHandler,
    forbiddenHandler,
    badRequestHandler,
    genericErrorHandler,
} = require("./errorHandlers/index");
const server = express();
server.use(cors());
server.use(cookieParser());
server.use(helmet());
const staticFolderPath = join(__dirname, "../public");
server.use(express.static(staticFolderPath));
console.log(staticFolderPath);

server.use(passport.initialize());

server.use(express.json());
server.use("/listings", listingsRoute);
server.use("/users", userRoute);
server.use("/tenants", tenantRoute);

server.use(badRequestHandler);
server.use(forbiddenHandler);
server.use(notFoundHandler);
server.use(genericErrorHandler);

console.log(listEndpoints(server));
mongoose
    .connect(process.env.MONGO_STRING, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("Mongo Db connected"))
    .catch((err) => console.log(err));

module.exports = server;