export type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

interface RequestLike {
  method?: string;
  originalUrl?: string;
  path?: string;
  ip?: string;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  get?(name: string): string | undefined;
}

interface ResponseLike {
  statusCode: number;
  on(event: "finish", listener: () => void): void;
  json?(body: unknown): unknown;
  send?(body?: unknown): unknown;
  getHeader?(name: string): number | string | string[] | undefined;
}

type NextFunctionLike = () => void;

const REDACTED = "[REDACTED]";
const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "refresh_token",
  "jwt",
  "secret",
  "apiKey",
  "api_key",
  "bg-api-key",
  "BG_API_Key",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return REDACTED_KEYS.has(key) || REDACTED_KEYS.has(normalized) || normalized.includes("password") || normalized.includes("token") || normalized.includes("secret");
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[MaxDepth]";
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}...[truncated]` : value;
  if (typeof value !== "object") return value;
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redact(nestedValue, depth + 1),
    ])
  );
}

function captureBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  if (Buffer.isBuffer(body)) {
    const text = body.toString("utf8");
    return text.length > 2000 ? `${text.slice(0, 2000)}...[truncated]` : text;
  }
  return redact(body);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details = error as Error & {
      cause?: unknown;
      code?: unknown;
      detail?: unknown;
      table?: unknown;
      column?: unknown;
      constraint?: unknown;
    };

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: details.cause === undefined ? undefined : serializeError(details.cause),
      code: details.code,
      detail: details.detail,
      table: details.table,
      column: details.column,
      constraint: details.constraint,
    };
  }

  return { message: String(error) };
}

function cleanMeta(meta: LogMeta): LogMeta {
  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
}

function writeLog(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const logEntry = cleanMeta({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
  const line = JSON.stringify(logEntry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info: (message: string, meta?: LogMeta): void => writeLog("info", message, meta),
  warn: (message: string, meta?: LogMeta): void => writeLog("warn", message, meta),
  error: (message: string, error?: unknown, meta: LogMeta = {}): void =>
    writeLog("error", message, {
      ...meta,
      error: error === undefined ? undefined : serializeError(error),
    }),
};

export function createRequestLogger(service: string) {
  return function requestLogger(req: RequestLike, res: ResponseLike, next: NextFunctionLike): void {
    const startedAt = Date.now();
    let responseBody: unknown;

    if (typeof res.json === "function") {
      const originalJson = res.json.bind(res);
      res.json = (body: unknown): unknown => {
        responseBody = body;
        return originalJson(body);
      };
    }

    if (typeof res.send === "function") {
      const originalSend = res.send.bind(res);
      res.send = (body?: unknown): unknown => {
        if (responseBody === undefined) responseBody = body;
        return originalSend(body);
      };
    }

    res.on("finish", () => {
      const status = res.statusCode;
      const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const path = req.originalUrl ?? req.path;

      writeLog(level, "HTTP request completed", {
        service,
        method: req.method,
        path,
        status,
        durationMs: Date.now() - startedAt,
        userAgent: req.get?.("user-agent"),
        ip: req.ip,
        request: {
          query: redact(req.query),
          params: redact(req.params),
          body: redact(req.body),
        },
        response: {
          contentType: res.getHeader?.("content-type"),
          body: captureBody(responseBody),
        },
      });
    });

    next();
  };
}

export function createHealthHandler(service: string) {
  return function healthHandler(_req: RequestLike, res: { json(body: unknown): void }): void {
    logger.info("Health check", { service, status: "ok" });
    res.json({ status: "ok", service });
  };
}
