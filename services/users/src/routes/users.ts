import { Router, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import cookieParser from "cookie-parser";
import { db, users } from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";
import * as authService from "../services/auth.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(cookieParser());

router.post("/register", async (req, res, next) => {
  try {
    const { name, surname, username, email, password, role } = req.body as Record<string, string>;
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "User with same email exists" });
      return;
    }
    const hashed = await authService.hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        name,
        surname,
        username,
        email,
        password: hashed,
        role: role ?? "user",
      })
      .returning();
    const { password: _p, ...rest } = created!;
    res.status(201).json(rest);
  } catch (e) {
    next(e as Error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const user = await authService.findByCredentials(email ?? "", password ?? "");
    if (!user) {
      const err = new Error("Unable to login") as Error & { httpStatusCode?: number };
      err.httpStatusCode = 401;
      throw err;
    }
    const accessToken = authService.signAccessToken({ userId: user.id });
    const refreshToken = authService.signRefreshToken({ userId: user.id });
    await authService.saveRefreshToken(user.id, refreshToken);
    res.cookie("accessToken", accessToken, { httpOnly: true, sameSite: "lax" });
    res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: "lax" });
    res.json({ message: "Login successful", accessToken, refreshToken });
  } catch (e) {
    next(e as Error);
  }
});

router.post("/refreshToken", async (req, res, next) => {
  try {
    const oldRefresh = (req.body?.refreshToken ?? req.cookies?.refreshToken) as string | undefined;
    if (!oldRefresh) {
      res.status(403).json({ error: "Refresh token required" });
      return;
    }
    const { userId } = authService.verifyRefreshToken(oldRefresh);
    const valid = await authService.isRefreshTokenValid(userId, oldRefresh);
    if (!valid) {
      res.status(403).json({ error: "Invalid or expired refresh token" });
      return;
    }
    await authService.revokeRefreshToken(oldRefresh);
    const accessToken = authService.signAccessToken({ userId });
    const refreshToken = authService.signRefreshToken({ userId });
    await authService.saveRefreshToken(userId, refreshToken);
    res.cookie("accessToken", accessToken, { httpOnly: true, sameSite: "lax" });
    res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: "lax" });
    res.json({ accessToken, refreshToken });
  } catch (e) {
    next(e as Error);
  }
});

router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { password: _p, ...rest } = user;
  res.json(rest);
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
    const [data, countRow] = await Promise.all([
      db.select().from(users).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(users).then((r) => r[0]?.count ?? 0),
    ]);
    const total = typeof countRow === "number" ? countRow : (countRow as { count: number }).count;
    const meta = buildPaginationMeta(total, { page, limit, offset });
    const safe = data.map((u) => {
      const { password: _p, ...rest } = u;
      return rest;
    });
    res.json({ data: safe, meta });
  } catch (e) {
    next(e as Error);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { password: _p, ...rest } = user;
    res.json(rest);
  } catch (e) {
    next(e as Error);
  }
});

router.put("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {
      name: body.name,
      surname: body.surname,
      username: body.username,
      email: body.email,
      role: body.role,
      updatedAt: new Date(),
    };
    if (typeof body.password === "string" && body.password.length >= 7) {
      updates.password = await authService.hashPassword(body.password);
    }
    const [updated] = await db
      .update(users)
      .set(updates as Record<string, unknown>)
      .where(eq(users.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { password: _p, ...rest } = updated;
    res.json(rest);
  } catch (e) {
    next(e as Error);
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const refreshToken = (req.body?.refreshToken ?? req.cookies?.refreshToken) as string | undefined;
    if (refreshToken) await authService.revokeRefreshToken(refreshToken);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out" });
  } catch (e) {
    next(e as Error);
  }
});

router.post("/logoutAll", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user) await authService.revokeAllRefreshTokensForUser(req.user.id);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out from all devices" });
  } catch (e) {
    next(e as Error);
  }
});

export default router;
