import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.js";
import type { User } from "../db/schema.js";
import { verifyAccessToken } from "../services/auth.js";

export interface AuthRequest extends Request {
  user?: User;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const { userId } = verifyAccessToken(token);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
