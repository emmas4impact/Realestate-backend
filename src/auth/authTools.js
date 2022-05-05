import { sign, verify } from "jsonwebtoken"
import { findOne } from "../users/Schema"

const authenticate = async (user) => {
  try {
    // generate tokens
    const newAccessToken = await generateJWT({
      _id: user._id
    })
    console.log("new acces token ", newAccessToken)
    const newRefreshToken = await generateRefreshJWT({
      _id: user._id
    })

    user.refreshTokens = user.refreshTokens.concat({
      token: newRefreshToken
    })
    await user.save()

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken
    }
  } catch (error) {
    console.log(error)
    throw new Error(error)
  }
}

const generateJWT = (payload) =>
  new Promise((res, rej) =>
    sign(
      payload,
      process.env.JWT_SECRET, {
        expiresIn: "6m"
      },
      (err, token) => {
        if (err) rej(err)
        res(token)
      }
    )
  )

const verifyJWT = async (token) => {
  console.log("TOKEN FROM VERIFY", token)
  console.log(process.env.JWT_SECRET)
  return await new Promise((res, rej) =>

    verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log(err)
        rej(err)
      }

      console.log("DECODED", decoded)
      return res(decoded)
    })
  )
}


const generateRefreshJWT = (payload) =>
  new Promise((res, rej) =>
    sign(
      payload,
      process.env.REFRESH_JWT_SECRET, {
        expiresIn: "1 week"
      },
      (err, token) => {
        if (err) rej(err)
        res(token)
      }
    )
  )

const refreshToken = async (oldRefreshToken) => {
  const decoded = await verifyRefreshToken(oldRefreshToken)

  const user = await findOne({
    _id: decoded._id
  })

  if (!user) {
    throw new Error(`Access is forbidden`)
  }

  const currentRefreshToken = user.refreshTokens.find(
    (t) => t.token === oldRefreshToken
  )

  if (!currentRefreshToken) {
    throw new Error(`Refresh token is wrong`)
  }

  // generate tokens
  const newAccessToken = await generateJWT({
    _id: user._id
  })
  const newRefreshToken = await generateRefreshJWT({
    _id: user._id
  })

  // save in db
  const newRefreshTokens = user.refreshTokens
    .filter((t) => t.token !== oldRefreshToken)
    .concat({
      token: newRefreshToken
    })

  user.refreshTokens = [...newRefreshTokens]

  await user.save()

  return {
    token: newAccessToken,
    refreshToken: newRefreshToken
  }
}

const verifyRefreshToken = (token) =>
  new Promise((res, rej) =>
    verify(token, process.env.REFRESH_JWT_SECRET, (err, decoded) => {
      if (err) rej(err)
      res(decoded)
    })
  )

export default {
  authenticate,
  verifyJWT,
  refreshToken
}