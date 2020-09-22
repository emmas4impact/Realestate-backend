const express = require("express")
const listEndpoints = require("express-list-endpoints")
const mongoose = require("mongoose")
const helmet = require("helmet")
const cors = require("cors")
const listingsRoute = require("./Listings/list")

const server = express();

server.use(helmet())
const port = process.env.PORT || 2330 

server.use(express.json())
server.use("/listings", listingsRoute)

console.log(listEndpoints(server))
mongoose
.connect(process.env.MONGO_STRING,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    
})
.then(
    server.listen(port,()=>{
        console.log(`server is running on ${port}`)
    })
).catch((err)=> console.log(err))