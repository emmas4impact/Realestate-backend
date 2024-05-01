import server from "./server.mjs";

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log("=================================================");
  console.log(`server is running on ${port}`);
  console.log("=================================================");
});
