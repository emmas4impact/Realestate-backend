const { model, Schema } = require("mongoose");
const valid = require("validator");
const bcrypt = require("bcrypt");

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    surname: {
      type: String,
      required: true,
    },
    username:{
        type: String,
        required: true,
        
    },
    
    password:{
      type: String,
      required: true,
      minlength:7  
    },
    email: {
      type: String,
      required: true,
      
    },
    refreshTokens: [
        {
          token: {
            type: String,
            required: true,
          },
        },
      ],
   
},
  
  { timestamps: true }
);

userSchema.post("validate", function (error, doc, next) {
  if (error) {
    error.httpStatusCode = 400 ;
    next(error) ;
  } else {
    next() ;
  }
}) ;

userSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoError" && error.code === 11000) {
    error.httpStatusCode = 400 ;
    next(error) ;
  } else {
    next() ;
  }
}) ;

userSchema.methods.toJSON = function () {
    const user = this
    const userObject = user.toObject()
  
    delete userObject.password
    delete userObject.__v
  
    return userObject
  }
userSchema.statics.findByCredentials = async (email, password)=>{
    const user = await UserModel.findOne({email})
    console.log(user)
    const isMatch = await bcrypt.compare(password, user.password)
    
    if (!isMatch) {
        const err = new Error("Unable to login")
        err.httpStatusCode = 401
        throw err
    }

  return user
}
userSchema.pre("save", async function (next) {
    const user = this
  
    if (user.isModified("password")) {
      user.password = await bcrypt.hash(user.password, 8)
    }
  
    next()
})
  
userSchema.post("validate", function (error, doc, next) {
    if (error) {
      error.httpStatusCode = 400
      next(error)
    } else {
      next()
    }
  })
  userSchema.post("save", function (error, doc, next) {
    if (error.name === "MongoError" && error.code === 11000) {
      error.httpStatusCode = 400
      next(error)
    } else {
      next()
    }
  })
const UserModel = model("user", userSchema );

module.exports =UserModel;
