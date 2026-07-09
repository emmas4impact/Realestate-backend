import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "./errorHandler.js";

type ErrorHandlerArgs = Parameters<typeof errorHandler>;

function createResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));

  return {
    response: { headersSent: false, status } as ErrorHandlerArgs[2],
    json,
    status,
  };
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the real 500 error and returns a generic response", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { response, status, json } = createResponse();
    const err = new Error("database connection refused");

    errorHandler(
      err,
      { method: "GET", originalUrl: "/users" } as ErrorHandlerArgs[1],
      response,
      vi.fn() as ErrorHandlerArgs[3]
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });

    const logEntry = JSON.parse(String(consoleError.mock.calls[0]?.[0])) as {
      error: { message: string };
      level: string;
      service: string;
      status: number;
    };
    expect(logEntry.level).toBe("error");
    expect(logEntry.service).toBe("users");
    expect(logEntry.status).toBe(500);
    expect(logEntry.error.message).toBe("database connection refused");
  });

  it("keeps expected 4xx messages out of error logs", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { response, status, json } = createResponse();
    const err = Object.assign(new Error("Unable to login"), { httpStatusCode: 401 });

    errorHandler(
      err,
      { method: "POST", originalUrl: "/users/login" } as ErrorHandlerArgs[1],
      response,
      vi.fn() as ErrorHandlerArgs[3]
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "ERROR", message: "Unable to login" },
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
