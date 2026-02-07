import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT) || 5005;
app.listen(port, () => {
  console.log(`Inventory service running on port ${port}`);
  console.log(`OpenAPI docs: http://localhost:${port}/api-docs`);
});
