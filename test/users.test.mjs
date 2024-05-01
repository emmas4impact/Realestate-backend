import assert from "assert";
import app from "../src/server.mjs"; // Adjust the path to your app
import request from "supertest";

describe("GET all listings", () => {
  it("Should respond with a 200 status code", async () => {
    const response = await request(app).get("/users");
    assert.equal(response.statusCode, 200);
    //assert.equal(response.body.data._id, No)
  });
  it("return json response", function () {
    return request(app)
      .get("/users")
      .expect(200)
      .expect("Content-Type", /json/);
  });
});
