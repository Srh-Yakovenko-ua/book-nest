import type { ArgumentsHost } from "@nestjs/common";

import { describe, expect, it, vi } from "vitest";

import { fakeExecutionContext } from "../../test/fake.js";
import { SemaphoreWaitQueueFullError } from "../bounded-semaphore.js";
import { HttpErrorFilter } from "./http-error.filter.js";

type LogRecord = {
  err: { message: string; name: string; stack?: string };
  requestId?: string;
  status: number;
};

type ResponseCapture = {
  body: unknown;
  headers: Record<string, string>;
  status: number;
};

type ResponseStub = {
  end: () => void;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResponseStub;
};

const logSpy = {
  error: vi.fn<(record: LogRecord, message: string) => void>(),
  warn: vi.fn<(record: LogRecord, message: string) => void>(),
};

function createHost(): { capture: ResponseCapture; host: ArgumentsHost } {
  const capture: ResponseCapture = { body: null, headers: {}, status: 0 };
  const response: ResponseStub = {
    end: () => undefined,
    json: (body) => {
      capture.body = body;
    },
    setHeader: (name, value) => {
      capture.headers[name] = value;
    },
    status: (code) => {
      capture.status = code;
      return response;
    },
  };
  const host = fakeExecutionContext({ request: { requestId: "request-under-test" }, response });
  return { capture, host };
}

describe("HttpErrorFilter backpressure logging", () => {
  it("logs a shed upload at warn level without a stack trace", () => {
    const { capture, host } = createHost();

    new HttpErrorFilter(logSpy).catch(new SemaphoreWaitQueueFullError("media-upload"), host);

    expect(logSpy.error).toHaveBeenCalledTimes(0);
    expect(logSpy.warn).toHaveBeenCalledTimes(1);

    const record = logSpy.warn.mock.calls[0]?.[0];

    expect(record?.status).toBe(503);
    expect(record?.err.name).toBe("ServiceUnavailableError");
    expect(record?.err.stack).toBeUndefined();
    expect(capture.status).toBe(503);
    expect(capture.headers["Retry-After"]).toBe("15");
    expect(capture.body).toEqual({
      code: "SERVER_BUSY",
      message: "Server is busy, please retry",
      requestId: "request-under-test",
    });
  });

  it("still logs a genuine server fault at error level with its stack trace", () => {
    const { host } = createHost();

    new HttpErrorFilter(logSpy).catch(new Error("boom"), host);

    expect(logSpy.warn).toHaveBeenCalledTimes(0);
    expect(logSpy.error).toHaveBeenCalledTimes(1);

    const record = logSpy.error.mock.calls[0]?.[0];

    expect(record?.status).toBe(500);
    expect(typeof record?.err.stack).toBe("string");
  });
});
