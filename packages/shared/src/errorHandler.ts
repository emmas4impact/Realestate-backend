import { logger } from "./logger.js";

interface HttpError extends Error {
  httpStatusCode?: number;
  status?: number;
  statusCode?: number;
}

interface RequestLike {
  method?: string;
  originalUrl?: string;
  path?: string;
}

interface ResponseLike {
  headersSent: boolean;
  status(statusCode: number): {
    json(body: unknown): void;
  };
}

type NextFunctionLike = (...args: unknown[]) => void;

export interface ErrorHandlerOptions {
  service: string;
}

export function createErrorHandler(options: ErrorHandlerOptions) {
  return function errorHandler(
    err: HttpError,
    req: RequestLike,
    res: ResponseLike,
    _next: NextFunctionLike
  ): void {
    const status = err.httpStatusCode ?? err.statusCode ?? err.status ?? 500;
    const isServerError = status >= 500;

    if (isServerError) {
      logger.error("Unhandled service error", err, {
        service: options.service,
        status,
        method: req.method,
        path: req.originalUrl ?? req.path,
      });
    }

    if (!res.headersSent) {
      res.status(status).json({
        success: false,
        error: {
          code: isServerError ? "INTERNAL_ERROR" : "ERROR",
          message: isServerError ? "Internal server error" : err.message ?? "Request failed",
        },
      });
    }
  };
}
