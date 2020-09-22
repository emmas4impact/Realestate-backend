const { model, Schema } = require("mongoose");


const ListingSchema = new Schema(
  {
    title: { type: String, required: true },
    address: {
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
    descroption: { type: String, required: true },
    features: { type: Array, required: true },
    details: { type: Array, required: true },
    image: { type: Buffer, required: true, default: "https://img.fixthephoto.com/blog/images/gallery/news_image_212.jpg" },
   //validaton
   
  },
  { timestamps: true }
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
ListingSchema.post("validate", function (error, doc, next) {
  if (error) {
    error.httpStatusCode = 400 ;
    next(error) ;
  } else {
    next() ;
  }
}) ;

ListingSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoError" && error.code === 11000) {
    error.httpStatusCode = 400 ;
    next(error) ;
  } else {
    next() ;
  }
}) ;
const ListingModel = model("house", ListingSchema);

module.exports = ListingModel;
