import { Router } from "express";
import q2m from "query-to-mongo";
import ListingModel from "./Schema.mjs";
import TenantModel from "../Tenants/Schema.mjs";
const houseRoute = Router();
import multer from "multer";
import { join } from "path";
import fs from "fs-extra"; // Import 'fs' directly for 'writeFileSync'
const { writeFile } = fs; // Using writeFileSync
import { fileURLToPath } from "url";
import { dirname } from "path";
import authTools from "../middlewares/auth/authTools.mjs";
const { authenticate } = authTools;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const upload = multer({});
const imagePath = join(__dirname, "../../public/images/homes");

import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// import pkgs from "fs-extra";
// const { writeFile } = pkgs;
// const upload = multer({});
// const imagePath = join(__dirname, "../../public/images/homes");
// console.log(imagePath);

//import { adminOnlyMiddleware, authorize } from "../middlewares/authorize.mjs";

houseRoute.get("/", authenticate, async (req, res, next) => {
  try {
    const parsedQuery = q2m(req.query);
    const allListings = await ListingModel.find(
      parsedQuery.criteria,
      parsedQuery.options.fields
    )
      .sort(parsedQuery.options.sort)
      .limit(parsedQuery.options.limit)
      .skip(parsedQuery.options.skip);

    res.send({
      data: allListings,
      Total: allListings.length,
    });
  } catch (error) {
    next(error);
  }
});

houseRoute.get("/:id", authenticate, async (req, res, next) => {
  try {
    const ListingById = await ListingModel.findById(req.params.id);
    if (ListingById) {
      res.status(200).send(ListingById);
    } else {
      res.send(`No listing Found with ID ${req.params.id}`);
    }
  } catch (error) {
    next(error);
  }
});

houseRoute.post(
  "/:id/upload",

  upload.single("house"),
  authenticate,
  async (req, res, next) => {
    try {
      await writeFile(join(imagePath, `${req.params.id}.png`), req.file.buffer);
      req.body = {
        image: `${process.env.SERVER_URL}/homes/${req.params.id}.png`,
      };

      const post = await ListingModel.findByIdAndUpdate(
        req.params.id,
        req.body
      );
      if (post) {
        res.send("image uploaded");
      }
    } catch (error) {
      next(error);
    }
  }
);
houseRoute.post(
  "/uploadMultiple/:id",
  upload.array("houses"),
  authenticate,
  async (req, res, next) => {
    try {
      const images = [];
      const arrayOfPromises = req.files.map((file) =>
        writeFile(join(imagePath, file.originalname), file.buffer)
      );
      //await fs.writeFile(path.join(imagePath, `${req.params.id}.png`), req.file.buffer)
      await Promise.all(arrayOfPromises);
      req.body = {
        images: [`http://localhost:5000/images/${req.params.id}.png`],
      };

      const arryOfPost = await ListingModel.findByIdAndUpdate(
        req.params.id,
        req.body
      );
      if (arryOfPost) {
        res.send("image uploaded");
      }
    } catch (error) {
      next(error);
    }
  }
);
houseRoute.post("/:id/tenants", async (req, res, next) => {
  try {
    const newTenant = new TenantModel({
      ...req.body,
      property: req.params.id,
    });
    const savedTenant = await newTenant.save();
    //res.status(201).send(newTenant);
    console.log(savedTenant);
    if (savedTenant) {
      const list = await ListingModel.findById(req.params.id);
      console.log(list);
      console.log(list._id);
      console.log(savedTenant.property);
      const verfiedId = String(list._id) === String(savedTenant.property);
      console.log(verfiedId);
      if (verfiedId) {
        console.log(list.description);
        const msg = {
          to: savedTenant.email, // Change to your recipient
          from: "bridgehomes.realestate@gmail.com", // Change to your verified sender
          subject: "Housing Application of " + list.title,
          text: `${list.title}`,
          html: `<h1>${list.title}</h1>
                <strong>
          
                Description: ${list.description}
          </strong>
          <br>
          
           
           <h4>District: ${list.district}</h4>
            
            <h4>Region: ${list.region}</h4>
             
             <h4>Price: ₦ ${list.price}</h4>
              
            <h4>Category: ${list.category}</h4>
             
             <h4>Address: ${list.location.formattedAddress}</h4>
             
             <h2>Thank You for contacting Bridge Homes</h2>
             
             <h5>Kind regards,<h5>
             <br>
             <h5>Abiodun Olarenwaju</h5>
             <br>
             <h5>CEO BRIDGE HOMES, Lagos Nigeria</h5>
          `,
        };
        send(msg)
          .then(() => {
            console.log("Email sent");
          })
          .catch((error) => {
            console.error(error);
          });
        res.send("email Sent");
      } else {
        res.send("check conditions");
      }
    } else {
      const error = new Error(`Experience with id ${req.params.id} not found`);
      error.httpStatusCode = 404;
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

houseRoute.post(
  "/images/image/:id",
  upload.array("post"),
  authenticate,
  async (req, res, next) => {
    try {
      console.log(req.files);
      const images = [];
      await Promise.all(
        req.files.map(async (e) => {
          const resolved = await writeFile(
            join(
              __dirname,
              `../../public/images/${req.params.id + e.originalname}`
            ),
            e.buffer
          );
          images.push(
            process.env.SERVER_URL + "/images/" + req.params.id + e.originalname
          );
        })
      );
      await Promise.all(
        images.map(async (e) => {
          const post = await update(
            {
              _id: req.params.id,
            },
            {
              $push: {
                images: e,
              },
            }
          );
        })
      );
      const added = await findById(req.params.id);
      res.send(added);
    } catch (err) {
      next(err);
    }
  }
);

houseRoute.get("/district/:district", async (req, res, next) => {
  try {
    const query = {
      district: req.params.district,
    };
    const listingByDistrict = await ListingModel.find(query);
    if (listingByDistrict) {
      res
        .status(200)
        .send({ data: listingByDistrict, count: listingByDistrict.length });
    } else {
      res.send(`Location with this adress: ${listingByDistrict} NOT FOUND`);
    }
  } catch (error) {
    next(error);
  }
});

houseRoute.get("/price/range", authenticate, async (req, res, next) => {
  try {
    const query = {
      price: req.params.price,
    };
    const listingByprice = await ListingModel.find({
      price: {
        $gte: Number(req.query.price),
        $lt: Number(req.query.price2),
      },
    }).sort({
      price: 1,
    });
    console.log(listingByprice);
    if (listingByprice) {
      res.send({
        data: listingByprice,
        Total: listingByprice.length,
      });
    } else {
      res.send(`Location with this adress: ${listingByprice} NOT FOUND`);
    }
  } catch (error) {
    next(error);
  }
});
houseRoute.post("/", authenticate, async (req, res, next) => {
  try {
    const newListing = new ListingModel(req.body);
    const addhouse = await newListing.save();
    res.status(201).send({ data: addhouse });
  } catch (error) {
    next(error);
  }
});

houseRoute.put("/:id", authenticate, async (req, res, next) => {
  try {
    const updateListings = await ListingModel.findByIdAndUpdate(
      req.params.id,
      req.body
    );
    if (updateListings) {
      res.status(201).send(updateListings);
    } else {
      const error = new Error(`listings with id ${req.params.id} not found`);
      error.httpStatusCode = 404;
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

houseRoute.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const deleteListings = await ListingModel.findByIdAndDelete(req.params.id);
    if (deleteListings) {
      res.status(202).send("record deleted succesfully");
    } else {
      res.send(`Record with id ${req.params.id} Not found!`);
    }
  } catch (error) {
    next(error);
  }
});

export default houseRoute;
