// import request from "supertest";
// ///const { response } = require("../src/server.mjs").default.default;
// import server from "../src/server.mjs";

// describe("Test routes", () => {
//   test("Should get list of listings", async () => {
//     const response = await request(server).get("/listings");
//     expect(response.statusCode).toBe(200);
//   });
//   test("Should return list of tenants ", async () => {
//     const response = await request(server).get("/tenants");
//     expect(response.statusCode).toBe(200);
//   });
//   test("Should return loggedin Users", (done) => {
//     return request(server)
//       .post("/users/login")
//       .send({ email: "emma@yahoo.com", password: "123" })
//       .expect(200)
//       .end((err, response) => {
//         console.log(response);
//         done();
//       });
//   });
// });
import assert from "assert";
import app from "../src/server.mjs"; // Adjust the path to your app
import request from "supertest";

describe("GET all listings", () => {
  it("Should respond with a 200 status code", async () => {
    const response = await request(app).get("/listings");
    assert.equal(response.statusCode, 200);
    //assert.equal(response.body.data._id, No)
  });
  it("return json response", function () {
    return request(app)
      .get("/listings")
      .expect(200)
      .expect("Content-Type", /json/);
  });
});
