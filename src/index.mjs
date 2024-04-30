import server from "./server.mjs";
const port = process.env.PORT || 5000;
console.log(port);
server.listen(port, () => {
  console.log(`server is running on ${port}`);
});
