import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, users, refreshTokens } from "../db/index.js";
import type { User } from "../db/schema.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-jwt-secret";
const REFRESH_SECRET = process.env.REFRESH_JWT_SECRET ?? "change-me-refresh-secret";
const ACCESS_EXP = "15m";
const REFRESH_EXP = "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXP });
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

export function verifyAccessToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
  return decoded;
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, REFRESH_SECRET) as { userId: string };
  return decoded;
}

export async function findByCredentials(email: string, password: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  const ok = await verifyPassword(password, user.password);
  return ok ? user : null;
}

export async function saveRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await db.insert(refreshTokens).values({ userId, token, expiresAt });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

export async function isRefreshTokenValid(userId: string, token: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.token, token)))
    .limit(1);
  return row != null && new Date() < row.expiresAt;
}
