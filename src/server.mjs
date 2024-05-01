import dotenv from "dotenv";
dotenv.config();
import express from "express";
import listEndpoints from "express-list-endpoints";
import helmet from "helmet";
import cors from "cors";
import authTools from "./middlewares/auth/authTools.mjs";
import { join } from "path";
import cookieParser from "cookie-parser";
import connectDB from "./utils/mongoDbCon.mjs";
import houseRoute from "./Listings/list.mjs";
import tenantRoute from "./Tenants/index.mjs";
import userRouter from "./users/index.mjs";
import errorHandlers from "./errorHandlers/index.mjs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const server = express();
const whitelist = ["http://localhost:3000"];
const corsOptions = {
  origin: (origin, callback) => {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

server.use(cors());
server.use(cookieParser());
server.use(helmet());
const staticFolderPath = join(__dirname, "../public");
console.log(staticFolderPath);
server.use(express.static(staticFolderPath));

server.use(express.json());
server.use("/listings", houseRoute);
server.use("/users", userRouter);
server.use("/tenants", tenantRoute);
server.use(authTools.authenticate);
server.use(errorHandlers.badRequestHandler);
server.use(errorHandlers.notFoundHandler);
server.use(errorHandlers.forbiddenHandler);
server.use(errorHandlers.genericErrorHandler);

console.log(listEndpoints(server));
connectDB().then(() => {});
export default server;
