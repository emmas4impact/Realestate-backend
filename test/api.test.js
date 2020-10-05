const request = require("supertest");
const { response } = require("../src/server");
const server = require("../src/server");

describe("Test routes", () => {
  test("Should get list of listings", () => {
    return request(server)
      .get("/listings")
      .then((response) => {
        expect(response.statusCode).toBe(200);
      });
  });
  test("Should return list of tenants ", () => {
    return request(server)
      .get("/tenants")
      .then((response) => {
        expect(response.statusCode).toBe(200);
      });
  });
  test("Should return loggedin Users", (done) => {
    return request(server)
      .post("/users/login")
      .send({ email: "emmas4impact@yahoo.com", password: "london123" })
      .expect(200)
      .end((err, response) => {
        console.log(response);
        done();
      });
  });
});
