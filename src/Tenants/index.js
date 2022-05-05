import { Router } from "express";
import TenantModel, { find, findById, findByIdAndUpdate, findByIdAndDelete } from "./Schema";
import ListingModel from "../Listings/Schema";
import { setApiKey, send } from "@sendgrid/mail";
setApiKey(process.env.SENDGRID_API_KEY);
const userRoute = Router();
import { adminOnlyMiddleware, authorize } from "../middlewares/authorize";

userRoute.get("/", authorize, async (req, res, next) => {
  try {
    const getTenant = await find(req.query).populate("house");
    res.send({
      data: getTenant,
      Total: getTenant.length,
    });
  } catch (error) {
    next(error);
  }
});
userRoute.get("/:id", async (req, res, next) => {
  try {
    const tenantById = await findById(req.params.id);
    if (tenantById) res.status(200).send(tenantById);
    else res.send(`No Tenant found with such Id: ${req.params.id}`);
  } catch (error) {
    next(error);
  }
});
userRoute.post("/", async (req, res, next) => {
  try {
    const newTenant = new TenantModel(req.body);
    await newTenant.save();
    res.status(201).send(newTenant);
    const msg = {
      to: "emmans4destiny@gmail.com", // Change to your recipient
      from: "test@example.com", // Change to your verified sender
      subject: "Sending with SendGrid is Fun",
      text: "and easy to do anywhere, even with Node.js",
      html: "<strong>and easy to do anywhere, even with Node.js</strong>",
    };
    send(msg)
      .then(() => {
        console.log("Email sent");
      })
      .catch((error) => {
        console.error(error);
      });
  } catch (error) {
    next(error);
  }
});
userRoute.put("/:id", async (req, res, next) => {
  try {
    const updateTenant = await findByIdAndUpdate(
      req.params.id,
      req.body
    );
    if (updateTenant) {
      res.send("Updated successfully!");
    } else {
      const error = new Error(`Experience with id ${req.params.id} not found`);
      error.httpStatusCode = 404;
      next(error);
    }
  } catch (error) {
    next(error);
  }
});
userRoute.delete("/:id", async (req, res, next) => {
  try {
    const deletedTenant = await findByIdAndDelete(req.params.id);
    if (deletedTenant) {
      res.send("deleted Successfully");
    } else {
      const error = new Error(`Tenant with id ${req.params.id} not found`);
      error.httpStatusCode = 404;
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

export default userRoute;
