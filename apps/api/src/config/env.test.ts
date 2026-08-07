import { describe, expect, it } from "vitest";

import { type EnvParseResult, parseEnv } from "./env.js";

function parseWith({ value, variable }: { value: string; variable: string }): EnvParseResult {
  return parseEnv({ ...process.env, [variable]: value });
}

function rejectionReport(result: EnvParseResult): string {
  if (result.ok) throw new Error("expected the environment to be rejected");
  return result.report;
}

describe("media concurrency env bounds", () => {
  it("accepts the highest values the container budget allows", () => {
    expect(parseWith({ value: "8", variable: "MEDIA_UPLOAD_CONCURRENCY" }).ok).toBe(true);
    expect(parseWith({ value: "2", variable: "MEDIA_DECODE_CONCURRENCY" }).ok).toBe(true);
  });

  it("refuses an upload concurrency above eight", () => {
    const report = rejectionReport(parseWith({ value: "9", variable: "MEDIA_UPLOAD_CONCURRENCY" }));

    expect(report).toContain("MEDIA_UPLOAD_CONCURRENCY");
  });

  it("refuses a decode concurrency above two", () => {
    const report = rejectionReport(parseWith({ value: "3", variable: "MEDIA_DECODE_CONCURRENCY" }));

    expect(report).toContain("MEDIA_DECODE_CONCURRENCY");
  });

  it("refuses a typo that would disable the upload bound entirely", () => {
    const report = rejectionReport(
      parseWith({ value: "30", variable: "MEDIA_UPLOAD_CONCURRENCY" }),
    );

    expect(report).toContain("MEDIA_UPLOAD_CONCURRENCY");
  });
});
