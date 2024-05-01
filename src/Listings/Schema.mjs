import { model, Schema } from "mongoose";
import geocoder from "../utils/geocoder.mjs";
const ListingSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    region: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        index: "2dsphere",
      },
      formattedAddress: String,
    },
    district: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    }, //VALIDATION
    rating: {
      type: Number,
      min: [1, "Sorry you can't rate below 1!"],
      max: [5, "MAximum rating is 5"],
      validate(value) {
        if (value < 0) {
          throw new Error("rate must be a positive number!");
        }
      },
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    features: {
      type: Array,
      required: true,
    },
    details: {
      type: Array,
      required: true,
    },
    image: {
      type: String,
      required: true,
      default:
        "https://img.fixthephoto.com/blog/images/gallery/news_image_212.jpg",
    },
    images: {
      type: Array,
    },
    category: {
      type: String,
      required: true,
    },
    //validaton
  },

  {
    timestamps: true,
  }
);

ListingSchema.pre("save", async function (next) {
  const loc = await geocoder.geocode(this.address);

  console.log("I am here", loc);
  this.location = {
    type: "Point",
    coordinates: [loc[0].longitude, loc[0].latitude],
    formattedAddress: loc[0].formattedAddress,
  };
  console.log(loc);
  this.address = undefined;
  next();
  console.log(loc);
});
ListingSchema.post("validate", function (error, doc, next) {
  if (error) {
    error.httpStatusCode = 400;
    next(error);
  } else {
    next();
  }
});

ListingSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoError" && error.code === 11000) {
    error.httpStatusCode = 400;
    next(error);
  } else {
    next();
  }
});
const ListingModel = model("house", ListingSchema);

export default ListingModel;
