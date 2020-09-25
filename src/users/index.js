const express =require("express")
const UserModel = require("./Schema")
const {authenticate, refreshToken }= require("../auth/authTools")
const {authorize, adminOnlyMiddleware} = require("../middlewares/authorize")
const router = express.Router()
const bcrypt = require("bcrypt");
const passport = require("passport");

router.post("/register", async (req, res) => {
    try {
      const checkEmail = await UserModel.find({ email: req.body.email });
      console.log(checkEmail);
      if (checkEmail.length !== 0) {
        res.status(409).send("user with same email exists");
      } else {
        // const plainPassword = req.body.password;
        // req.body.password = await bcrypt.hash(plainPassword, 8);
        // console.log(req.body);
        const newUser = new UserModel(req.body);
        await newUser.save();
        res.status(201).send("registered successfuly");
      }
    } catch (error) {
      //next(error);
      res.send(error.errors);
    }
  });
router.get("/", adminOnlyMiddleware, async(req, res, next)=>{
    try {
        const users = await UserModel.find(req.query)
        res.send({
            data: users,
            total: users.length
        })
    } catch (error) {
        console.log(error)
        next(error)
    }
})
router.get("/me", authorize, async (req, res, next) => {
    try {
      res.send(req.user)
    } catch (error) {
      next("While reading users list a problem occurred!")
    }
  })

router.get("/:id", authorize, async(req, res, next)=>{
  try {
      const users = await UserModel.findById(req.params.id)
      res.send(users)
  } catch (error) {
      console.log(error)
      next(error)
  }
})


router.put("/:name", authorize, async(req, res,next)=>{
  try {
    const updatedUser = await UserModel.findOneAndUpdate(req.params.name, {...req.body})
    
    if(updatedUser)
      res.send("user details updated ")
    res.send(`${req.params.name} not found`)
  } catch (error) {
    next(error)
  }
})

router.post("/login", async(req, res, next)=>{
    try {
        const {email, password}= req.body
        const user = await UserModel.findByCredentials(email, password)
        console.log(user)
        const token  = await authenticate(user)
        console.log("newly generated token : ",token)
        res.cookie("accessToken", token)
        res.send(token)
    } catch (error) {
        
    }
    
})
router.post("/logout", authorize, async (req, res, next) => {
    try {
      req.user.refreshTokens = req.user.refreshTokens.filter(
        (t) => t.token !== req.body.refreshToken
      )
      await req.user.save()
      res.send()
    } catch (err) {
      next(err)
    }
  })

  router.post("/logoutAll", authorize, async (req, res, next) => {
    try {
      req.user.refreshTokens = []
      await req.user.save()
      res.send()
    } catch (err) {
      next(err)
    }
  })
  
  router.post("/refreshToken", async (req, res, next) => {
    const oldRefreshToken = req.body.refreshToken
    if (!oldRefreshToken) {
      const err = new Error("Forbidden")
      err.httpStatusCode = 403
      next(err)
    } else {
      try {
        const newTokens = await refreshToken(oldRefreshToken)
        res.send(newTokens)
      } catch (error) {
        console.log(error)
        const err = new Error(error)
        err.httpStatusCode = 403
        next(err)
      }
    }
  })

module.exports = router;