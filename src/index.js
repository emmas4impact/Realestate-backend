import { listen } from "./server";
const port = process.env.PORT;
console.log(port)
listen(port, () => {
    console.log(`server is running on ${port}`);
});