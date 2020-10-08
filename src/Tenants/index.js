const express = require("express");
const TenantModel = require("./Schema");
const ListingModel = require("../Listings/Schema");
const userRoute = express.Router();

userRoute.get("/", async (req, res, next) => {
  try {
    const getTenant = await TenantModel.find(req.query).populate("house");
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
    const tenantById = await TenantModel.findById(req.params.id);
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
  } catch (error) {
    next(error);
  }
});
userRoute.put("/:id", async (req, res, next) => {});
userRoute.delete("/:id", async (req, res, next) => {});

module.exports = userRoute;
