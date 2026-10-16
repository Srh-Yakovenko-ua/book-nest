import { describe, expect, it } from "vitest";

import { requestLogFields, requestLogLevel } from "./request-logger.middleware.js";

describe("requestLogLevel", () => {
  it("keeps shed backpressure out of the error stream", () => {
    expect(requestLogLevel({ failed: false, statusCode: 503 })).toBe("warn");
  });

  it("still reports genuine server faults as errors", () => {
    expect(requestLogLevel({ failed: false, statusCode: 500 })).toBe("error");
    expect(requestLogLevel({ failed: true, statusCode: 503 })).toBe("error");
  });

  it("keeps client faults at warn and successes at info", () => {
    expect(requestLogLevel({ failed: false, statusCode: 404 })).toBe("warn");
    expect(requestLogLevel({ failed: false, statusCode: 200 })).toBe("info");
  });
});

describe("requestLogFields", () => {
  const base = { id: "req-1", ip: "203.0.113.9", method: "GET" };

  it("logs the path without the query string", () => {
    const fields = requestLogFields({
      ...base,
      currentUser: undefined,
      url: "/api/auth/nickname-available?nickname=reader%40example.com",
    });

    expect(fields.path).toBe("/api/auth/nickname-available");
    expect(JSON.stringify(fields)).not.toContain("nickname=");
  });

  it("names the signed-in user and the client address", () => {
    const fields = requestLogFields({ ...base, currentUser: { id: "user-7" }, url: "/api/books" });

    expect(fields).toEqual({
      id: "req-1",
      ip: "203.0.113.9",
      method: "GET",
      path: "/api/books",
      userId: "user-7",
    });
  });

  it("writes null rather than omitting the actor on anonymous requests", () => {
    const fields = requestLogFields({ ...base, currentUser: undefined, ip: undefined, url: "/" });

    expect(fields.userId).toBeNull();
    expect(fields.ip).toBeNull();
  });
});
