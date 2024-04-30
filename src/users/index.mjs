import express from "express";
const userRouter = express.Router();
import UserModel from "./Schema.mjs";
import authTools from "../auth/authTools.mjs";
//import { authorize, adminOnlyMiddleware } from "../middlewares/authorize";

userRouter.post("/register", async (req, res) => {
  try {
    const checkEmail = await UserModel.find({
      email: req.body.email,
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
userRouter.get("/", async (req, res, next) => {
  try {
    const users = await UserModel.find(req.query);
    res.send({
      data: users,
      total: users.length,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});
userRouter.get("/me", async (req, res, next) => {
  try {
    res.send(req.user);
  } catch (error) {
    next("While reading users list a problem occurred!");
  }
});

userRouter.get("/:id", async (req, res, next) => {
  try {
    const users = await UserModel.findById(req.params.id);
    res.send(users);
  } catch (error) {
    console.log(error);
    next(error);
  }
});

userRouter.put("/:name", async (req, res, next) => {
  try {
    const updatedUser = await UserModel.findOneAndUpdate(req.params.name, {
      ...req.body,
    });

    if (updatedUser) res.send("user details updated ");
    res.send(`${req.params.name} not found`);
  } catch (error) {
    next(error);
  }
});

userRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findByCredentials(email, password);
    console.log(user);
    const tokens = await authTools.authenticate(user);
    console.log("newly generated token : ", tokens);
    res.cookie("accessToken", tokens.token);
    res.cookie("refreshToken", tokens.refreshToken);
    res.send("login successfully");
  } catch (error) {
    next(error);
  }
});
userRouter.post("/logout", async (req, res, next) => {
  try {
    req.user.refreshTokens = req.user.refreshTokens.filter(
      (t) => t.token !== req.body.refreshToken
    );
    await req.user.save();
    res.send();
  } catch (err) {
    next(err);
  }
});

userRouter.post("/logoutAll", async (req, res, next) => {
  try {
    req.user.refreshTokens = [];
    await req.user.save();
    res.send();
  } catch (err) {
    next(err);
  }
});

userRouter.post("/refreshToken", async (req, res, next) => {
  const oldRefreshToken = req.body.refreshToken;
  if (!oldRefreshToken) {
    const err = new Error("Forbidden");
    err.httpStatusCode = 403;
    next(err);
  } else {
    try {
      const newTokens = await authTools.refreshToken(oldRefreshToken);
      res.send(newTokens);
    } catch (error) {
      console.log(error);
      const err = new Error(error);
      err.httpStatusCode = 403;
      next(err);
    }
  }
});

export default userRouter;
