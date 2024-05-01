import assert from "assert";
import app from "../src/server.mjs"; // Adjust the path to your app
import request from "supertest";
const apiKey = process.env.BG_API_Key;
describe("GET all listings", () => {
  it("Should respond with a 200 status code", async () => {
    try {
      const response = await request(app)
        .get("/listings")
        .set("bg-api-key", apiKey)
        .assert.equal(response.statusCode, 200);
    } catch (error) {}

    //assert.equal(response.body.data._id, No)
  });
  it("return json response", function () {
    return request(app)
      .get("/listings")
      .set("bg-api-key", apiKey)
      .expect(200)
      .expect("Content-Type", /json/);
  });
  it("Should fetch by district", async () => {
    let dis = "Malmikartano";
    const response = await request(app)
      .get("/listings/district/:district")
      .query(dis)
      .set("bg-api-key", apiKey);
    assert.equal(response.statusCode, 200);
    //assert.equal(response.body.data._id, No)
  });
});
