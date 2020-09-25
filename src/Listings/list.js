const express = require("express")
const q2m = require("query-to-mongo")
const ListingModel = require("./Schema")
const houseRoute = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs-extra")
const upload = multer({})
const imagePath = path.join(__dirname, "../../public/images/homes")
console.log(imagePath)

const {
    adminOnlyMiddleware,
    authorize
} = require("../middlewares/authorize")

houseRoute.get("/", async (req, res, next) => {
    try {
        const allListings = await ListingModel.find(req.query).sort({
            allListings: 1
        })
        res.send({
            data: allListings,
            Total: allListings.length
        })
    } catch (error) {
        next(error)
    }

})

houseRoute.post("/:id/upload", authorize, upload.single("house"), async (req, res, next) => {
    try {
        await fs.writeFile(path.join(imagePath, `${req.params.id}.png`), req.file.buffer)
        req.body = {
            image: `http://localhost:5000/${req.params.id}.png`
        }

        const post = await ListingModel.findByIdAndUpdate(req.params.id, req.body)
        if (post) {
            res.send("image uploaded")
        }

    } catch (error) {
        next(error)
    }
})
houseRoute.post("/:id/uploadMultiple", upload.array("houses"), async (req, res, next) => {
    try {
        const arrayOfPromises = req.files.map(file => fs.writeFile(path.join(imagePath,
            file.originalname), file.buffer))
        //await fs.writeFile(path.join(imagePath, `${req.params.id}.png`), req.file.buffer)
        await Promise.all(arrayOfPromises)
        req.body = {
            images: [`http://localhost:5000/images/${req.params.id}.png`]
        }

        const arryOfPost = await ListingModel.findByIdAndUpdate(req.params.id, req.body)
        if (arryOfPost) {
            res.send("image uploaded")
        }

    } catch (error) {
        next(error)
    }
})
houseRoute.get("/:district", async (req, res, next) => {
    try {
        const query = {
            district: req.params.district
        }
        const listingByDistrict = await ListingModel.find(query)
        if (listingByDistrict) {} else {
            res.send(`Location with this adress: ${listingByDistrict} NOT FOUND`)
        }

    } catch (error) {
        next(error)
    }

})

houseRoute.get("/price/range", async (req, res, next) => {
    try {
        const query = {
            price: req.params.price
        }
        const listingByprice = await ListingModel
            .find({
                price: {
                    $gte: Number(req.query.price),
                    $lt: Number(req.query.price2)
                }
            }).sort({
                price: 1
            })
        console.log(listingByprice)
        if (listingByprice) {
            res.send({
                data: listingByprice,
                Total: listingByprice.length
            })
        } else {
            res.send(`Location with this adress: ${listingByprice} NOT FOUND`)
        }

    } catch (error) {
        next(error)
    }

})
houseRoute.post("/", authorize, async (req, res, next) => {
    try {
        const newListing = new ListingModel(req.body)
        const addhouse = await newListing.save()
        res.status(201).send(addhouse._id)
    } catch (error) {
        next(error)
    }
})

houseRoute.put("/:id", authorize, async (req, res, next) => {
    try {
        const updateListings = await ListingModel.findByIdAndUpdate(req.params.id, req.body)
        if (updateListings) {
            res.status(201).send(updateListings)
        } else {
            const error = new Error(`listings with id ${req.params.id} not found`);
            error.httpStatusCode = 404
            next(error)
        }

    } catch (error) {
        next(error)
    }


})

houseRoute.delete("/:id", authorize, async (req, res, next) => {
    try {
        const deleteListings = await ListingModel.findByIdAndDelete(req.params.id)
        if (deleteListings) {
            res.status(202).send("record deleted succesfully")
        } else {
            res.send(`Record with id ${req.params.id} Not found!`)
        }
    } catch (error) {
        next(error)
    }


})

module.exports = houseRoute;