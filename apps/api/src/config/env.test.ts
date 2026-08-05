import { describe, expect, it, vi } from "vitest";

type EnvLoad = { exited: boolean; output: string };

async function loadEnvWith({
  value,
  variable,
}: {
  value: string;
  variable: string;
}): Promise<EnvLoad> {
  const previous = process.env[variable];
  process.env[variable] = value;
  const exitCodes: number[] = [];
  const messages: string[] = [];
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCodes.push(code ?? 0);
  }) as (code?: null | number | string) => never);
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    messages.push(args.map((arg) => String(arg)).join(" "));
  });
  vi.resetModules();
  try {
    await import("./env.js");
  } finally {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    if (previous === undefined) {
      delete process.env[variable];
    } else {
      process.env[variable] = previous;
    }
  }
  return { exited: exitCodes.length > 0, output: messages.join("\n") };
}

describe("media concurrency env bounds", () => {
  it("accepts the highest values the container budget allows", async () => {
    const upload = await loadEnvWith({ value: "8", variable: "MEDIA_UPLOAD_CONCURRENCY" });
    const decode = await loadEnvWith({ value: "2", variable: "MEDIA_DECODE_CONCURRENCY" });

    expect(upload.exited).toBe(false);
    expect(decode.exited).toBe(false);
  });

  it("refuses an upload concurrency above eight", async () => {
    const load = await loadEnvWith({ value: "9", variable: "MEDIA_UPLOAD_CONCURRENCY" });

    expect(load.exited).toBe(true);
    expect(load.output).toContain("MEDIA_UPLOAD_CONCURRENCY");
  });

  it("refuses a decode concurrency above two", async () => {
    const load = await loadEnvWith({ value: "3", variable: "MEDIA_DECODE_CONCURRENCY" });

    expect(load.exited).toBe(true);
    expect(load.output).toContain("MEDIA_DECODE_CONCURRENCY");
  });

  it("refuses a typo that would disable the upload bound entirely", async () => {
    const load = await loadEnvWith({ value: "30", variable: "MEDIA_UPLOAD_CONCURRENCY" });

    expect(load.exited).toBe(true);
    expect(load.output).toContain("MEDIA_UPLOAD_CONCURRENCY");
  });
});
