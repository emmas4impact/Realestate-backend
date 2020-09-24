const jwt =require("jsonwebtoken")
const authenticate = async(user)=>{
    try {
        const newToken  = await generateJWT({_id: user._id})
        return newToken

    } catch (error) {
        throw new Error("Prolem with authentication")
    }
}
const generateJWT = (payload) => new Promise((res, rej)=>{
    jwt.sign(payload,
     process.env.JWT_SECRET,
    {expiresIn: "20m"},
    (err, token)=>{
        if(err)
            rej(err)
        res(token)
    } )
})

const verifyJWT = (token) => new Promise((res, rej)=>{
    jwt.verify(token,
     process.env.JWT_SECRET,
    (err, verified)=>{
        if(err)
            rej(err)
        res(verified)
    } )
})

module.exports = {authenticate, verifyJWT}