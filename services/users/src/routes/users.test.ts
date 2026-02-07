import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
const mockState = {
  selectByEmail: [] as unknown[],
  selectOne: [] as unknown[],
  selectList: [] as unknown[],
  selectCount: 0,
  insertReturn: [] as unknown[],
  updateReturn: [] as unknown[],
};

vi.mock("../db/index.js", () => {
  const chain = (result: unknown) => ({ then: (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn) });
  return {
    db: {
      select: (args?: { count?: unknown }) => ({
        from: () => ({
          where: () => ({
            limit: (n?: number) =>
              n === 1
                ? { then: (fn: (r: unknown) => unknown) => Promise.resolve(mockState.selectOne).then(fn) }
                : { offset: () => chain(mockState.selectList) },
            then: (fn: (r: unknown) => unknown) =>
              args && typeof args === "object" && "count" in args
                ? Promise.resolve([{ count: mockState.selectCount }]).then(fn)
                : Promise.resolve(mockState.selectList).then(fn),
          }),
          limit: (n?: number) =>
            n === 1
              ? { then: (fn: (r: unknown) => unknown) => Promise.resolve(mockState.selectByEmail.length ? mockState.selectByEmail : mockState.selectOne).then(fn) }
              : { offset: () => chain(mockState.selectList) },
          then: (fn: (r: unknown) => unknown) => Promise.resolve([{ count: mockState.selectCount }]).then(fn),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve(mockState.insertReturn),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(mockState.updateReturn),
          }),
        }),
      }),
    },
    users: {},
  };
});

vi.mock("../services/auth.js", () => ({
  hashPassword: (p: string) => Promise.resolve("hashed_" + p),
  findByCredentials: vi.fn(() => Promise.resolve(null)),
  signAccessToken: () => "mock-access-token",
  signRefreshToken: () => "mock-refresh-token",
  verifyAccessToken: (t: string) => ({ userId: t === "Bearer mock-access-token" ? TEST_UUID : "other" }),
  verifyRefreshToken: () => ({ userId: TEST_UUID }),
  saveRefreshToken: () => Promise.resolve(),
  revokeRefreshToken: () => Promise.resolve(),
  revokeAllRefreshTokensForUser: () => Promise.resolve(),
  isRefreshTokenValid: () => Promise.resolve(true),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = {
      id: TEST_UUID,
      name: "Test",
      surname: "User",
      username: "testuser",
      email: "test@test.com",
      password: "hashed",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    next();
  },
}));

const getApp = async () => (await import("../app.js")).default;

describe("Users routes", () => {
  beforeEach(() => {
    mockState.selectByEmail = [];
    mockState.selectOne = [];
    mockState.selectList = [];
    mockState.selectCount = 0;
    mockState.insertReturn = [];
    mockState.updateReturn = [];
  });

  it("POST /users/register returns 201 with created user (no password in body)", async () => {
    const created = { id: TEST_UUID, name: "John", surname: "Doe", username: "johnd", email: "john@test.com", password: "hashed", role: "user", createdAt: new Date(), updatedAt: new Date() };
    mockState.selectByEmail = [];
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app).post("/users/register").send({ name: "John", surname: "Doe", username: "johnd", email: "john@test.com", password: "secret123" });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("password");
    expect(res.body.email).toBe("john@test.com");
  });

  it("POST /users/register returns 409 when email exists", async () => {
    mockState.selectOne = [{ id: TEST_UUID, email: "existing@test.com" }];
    const app = await getApp();
    const res = await request(app).post("/users/register").send({ name: "A", surname: "B", username: "ab", email: "existing@test.com", password: "secret123" });
    expect(res.status).toBe(409);
  });

  it("POST /users/login returns 401 when credentials invalid", async () => {
    const app = await getApp();
    const res = await request(app).post("/users/login").send({ email: "u@test.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("POST /users/login returns 200 when credentials valid", async () => {
    const auth = await import("../services/auth.js");
    vi.mocked(auth.findByCredentials).mockResolvedValueOnce({
      id: TEST_UUID,
      name: "T",
      surname: "U",
      username: "tu",
      email: "u@test.com",
      password: "hash",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = await getApp();
    const res = await request(app).post("/users/login").send({ email: "u@test.com", password: "right" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
  });

  it("GET /users/me returns 200 with user when authenticated", async () => {
    const app = await getApp();
    const res = await request(app).get("/users/me").set("Authorization", "Bearer mock-access-token");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("test@test.com");
  });

  it("GET /users returns 200 and paginated shape when authenticated", async () => {
    const app = await getApp();
    const res = await request(app).get("/users").set("Authorization", "Bearer mock-access-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
  });

  it("GET /users/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/users/${TEST_UUID}`).set("Authorization", "Bearer mock-access-token");
    expect(res.status).toBe(404);
  });

  it("PUT /users/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app).put(`/users/${TEST_UUID}`).set("Authorization", "Bearer mock-access-token").send({ name: "Updated" });
    expect(res.status).toBe(404);
  });
});
