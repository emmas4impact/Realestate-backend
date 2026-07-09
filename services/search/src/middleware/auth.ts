import type { Request, Response, NextFunction } from "express";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["bg-api-key"];
  const envKey = process.env.BG_API_Key;
  if (!envKey) {
    next();
    return;
  }
  if (!apiKey) {
    res.status(401).json({ error: "API key required" });
    return;
  }
  if (apiKey !== envKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }
  next();
}
