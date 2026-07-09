export type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

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
