import type { Request, Response, NextFunction } from "express";

interface HttpError extends Error {
  httpStatusCode?: number;
}

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.httpStatusCode ?? 500;
  if (!res.headersSent) {
    res.status(status).json({
      success: false,
      error: { code: "ERROR", message: err.message ?? "Internal server error" },
    });
  }
}
