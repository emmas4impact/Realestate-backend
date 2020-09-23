const express = require("express")
const q2m = require("query-to-mongo")
const ListingModel= require("./Schema")
const houseRoute =  express.Router()

houseRoute.get("/", async(req, res, next)=>{
    try {
        const allListings = await ListingModel.find(req.query)
        res.send({date: allListings, Total: allListings.length})
    } catch (error) {
        next(error)
    }
    
})

houseRoute.get("/:district", async(req, res, next)=>{
   try {
       const query = { district: req.params.district}
       const listingByDistrict = await ListingModel.find(query)
       if(listingByDistrict){
           res.send({data: listingByDistrict, Total: listingByDistrict.length})
       }else{
        res.send(`Location with this adress: ${listingByDistrict} NOT FOUND`)
       }
       
   } catch (error) {
       next(error)
   }
    
})
houseRoute.post("/", async(req, res, next)=>{
    try {
        const newListing = new ListingModel(req.body)
        const addhouse = await newListing.save()
        res.status(201).send(addhouse._id)
    } catch (error) {
        next(error)
    }
})

houseRoute.put("/:id", async(req, res, next)=>{
    
    
})

houseRoute.delete("/:id", async(req, res, next)=>{
    
})

module.exports = houseRoute;