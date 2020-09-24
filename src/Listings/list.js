const express = require("express")
const q2m = require("query-to-mongo")
const ListingModel= require("./Schema")
const houseRoute =  express.Router()

houseRoute.get("/", async(req, res, next)=>{
    try {
        const allListings = await ListingModel.find(req.query).sort({allListings: 1})
        res.send({data: allListings, Total: allListings.length})
    } catch (error) {
        next(error)
    }
    
})

houseRoute.get("/:district", async(req, res, next)=>{
   try {
       const query = { district: req.params.district}
       const listingByDistrict = await ListingModel.find(query)
       if(listingByDistrict){
       }else{
        res.send(`Location with this adress: ${listingByDistrict} NOT FOUND`)
       }
       
   } catch (error) {
       next(error)
   }
    
})

houseRoute.get("/price/range", async(req, res, next)=>{
    try {
        const query = { price: req.params.price}
        const listingByprice = await ListingModel
        .find({price: {$gte: Number(req.query.price), $lt: Number(req.query.price2)}}).sort({price: 1})
        console.log(listingByprice)
        if(listingByprice){
            res.send({data: listingByprice, Total: listingByprice.length})
        }else{
         res.send(`Location with this adress: ${listingByprice} NOT FOUND`)
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
  try {
    const updateListings = await ListingModel.findByIdAndUpdate(req.params.id, req.body)
    if(updateListings){
        res.status(201).send(updateListings)
    }else{
        const error = new Error(`listings with id ${req.params.id} not found`);
        error.httpStatusCode=404
        next(error)
    }
      
  } catch (error) {
    next(error)
  }
    
    
})

houseRoute.delete("/:id", async(req, res, next)=>{
    
})

module.exports = houseRoute;