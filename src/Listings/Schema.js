const {
  model,
  Schema
} = require("mongoose");
const valid = require("validator");
const geocoder = require("../utils/geocoder")
const ListingSchema = new Schema({
    title: {
      type: String,
      required: true
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
    postcode: {
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
      required: true
    },
    features: {
      type: Array,
      required: true
    },
    details: {
      type: Array,
      required: true
    },
    image: {
      type: String,
      required: true,
      default: "https://img.fixthephoto.com/blog/images/gallery/news_image_212.jpg",
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
    timestamps: true
  }
);
// profileSchema.methods.toJSON = function () {
//   const user = this
//   const userObject = user.toObject()

//   delete userObject.password
//   delete userObject.__v

//   return userObject
// }

// profileSchema.statics.findByCredentials = async (email, password) => {
//   const user = await profileModel.findOne({ email }) ;
//   const isMatch = await bcrypt.compare(password, user.password) ;
//   if (!isMatch) {
//     const err = new Error("Unable to login") ;
//     err.httpStatusCode = 401 ;
//     throw err;
//   }
//   return user ;
// } ;

// profileSchema.pre("save", async function (next) {
//   const user = this
//   if (user.isModified("password")) {
//     user.password = await bcrypt.hash(user.password, 8) ;
//   }
//   next() ;
// }) ;

ListingSchema.pre('save', async function (next) {
  const loc = await geocoder.geocode(this.address)
  this.location = {
    type: 'Point',
    coordinates: [loc[0].longitude, loc[1].latitude],
    formattedAddress: loc[0].formattedAddress
  }
  this.address = undefined
  next()
  console.log(loc)
})
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

module.exports = ListingModel;