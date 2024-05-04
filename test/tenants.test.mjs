import assert from "assert";
import app from "../src/server.mjs"; // Adjust the path to your app
import request from "supertest";
const apiKey = process.env.BG_API_Key;

describe("GET all Tenants", () => {
  console.log(apiKey);
  it("Should respond with a 200 status code", async () => {
    const response = await request(app)
      .get("/tenants")
      .set("bg-api-key", apiKey);
    assert.equal(response.statusCode, 200);
    //assert.equal(response.body.data._id, No)
  });
  it("return json response", function () {
    return request(app)
      .get("/tenants")
      .set("bg-api-key", apiKey)
      .expect(200)
      .expect("Content-Type", /json/);
  });
});
