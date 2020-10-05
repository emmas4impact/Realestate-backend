const server = require("./server");
const port = process.env.PORT;
console.log(port)
server.listen(port, () => {
    console.log(`server is running on ${port}`);
});