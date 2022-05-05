import { Router } from "express"
import UserModel, { find, findById, findOneAndUpdate, findByCredentials } from "./Schema"
import { authenticate, refreshToken } from "../auth/authTools"
import { authorize, adminOnlyMiddleware } from "../middlewares/authorize"
const router = Router()
import bcrypt from "bcrypt"
import passport from "passport"

router.post("/register", async (req, res) => {
  try {
    const checkEmail = await find({
      email: req.body.email
    });
    console.log(checkEmail);
    if (checkEmail.length !== 0) {
      res.status(409).send("user with same email exists");
    } else {

      const newUser = new UserModel(req.body);
      await newUser.save();
      res.status(201).send("registered successfuly");
    }
  } catch (error) {
    //next(error);
    res.send(error.errors);
  }
});
router.get("/", adminOnlyMiddleware, async (req, res, next) => {
  try {
    const users = await find(req.query)
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

router.get("/:id", authorize, async (req, res, next) => {
  try {
    const users = await findById(req.params.id)
    res.send(users)
  } catch (error) {
    console.log(error)
    next(error)
  }
})


router.put("/:name", authorize, async (req, res, next) => {
  try {
    const updatedUser = await findOneAndUpdate(req.params.name, {
      ...req.body
    })

    if (updatedUser)
      res.send("user details updated ")
    res.send(`${req.params.name} not found`)
  } catch (error) {
    next(error)
  }
})

router.post("/login", async (req, res, next) => {
  try {
    const {
      email,
      password
    } = req.body
    const user = await findByCredentials(email, password)
    console.log(user)
    const tokens = await authenticate(user)
    console.log("newly generated token : ", tokens)
    res.cookie("accessToken", tokens.token)
    res.cookie("refreshToken", tokens.refreshToken)
    res.send("login successfully")
  } catch (error) {
    next(error)
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

export default router;