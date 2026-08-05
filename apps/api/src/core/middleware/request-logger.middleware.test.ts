import { describe, expect, it } from "vitest";

import { requestLogLevel } from "./request-logger.middleware.js";

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
