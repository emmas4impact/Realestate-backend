import request from "supertest";
///const { response } = require("../src/server.mjs").default.default;
import server from "../src/server.mjs";

describe("Test routes", () => {
  test("Should get list of listings", async () => {
    const response = await request(server).get("/listings");
    expect(response.statusCode).toBe(200);
  });
  test("Should return list of tenants ", async () => {
    const response = await request(server).get("/tenants");
    expect(response.statusCode).toBe(200);
  });
  test("Should return loggedin Users", (done) => {
    return request(server)
      .post("/users/login")
      .send({ email: "emma@yahoo.com", password: "123" })
      .expect(200)
      .end((err, response) => {
        console.log(response);
        done();
      });
  });
});
