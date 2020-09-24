const express = require("express")
const userRoute = express.Router()

userRoute.get("/", async(req, res, next)=>{})
userRoute.get("/:id", async(req, res, next)=>{})
userRoute.post("/", async(req, res, next)=>{})
userRoute.put("/:id", async(req, res, next)=>{})
userRoute.delete("/:id", async(req, res, next)=>{})


module.exports=userRoute;