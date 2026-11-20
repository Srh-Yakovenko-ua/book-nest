import { afterEach, describe, expect, it, vi } from "vitest";

const PROBE_URL = "/api/fetch-guard-probe";

const lateRequests: Promise<unknown>[] = [];

describe("unstubbed fetch guard", () => {
  it.fails("fails a test whose body sends a request nobody stubbed", async () => {
    await expect(fetch(PROBE_URL)).rejects.toThrow("Unstubbed fetch");
  });

  describe("once the test body has finished", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      lateRequests.push(fetch(PROBE_URL).catch((error: unknown) => error));
    });

    it("does not fail a test whose own stub was removed before a late request", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(new Response("{}"))),
      );

      expect((await fetch(PROBE_URL)).ok).toBe(true);
    });

    it("still rejects that late request so it never reaches the network", async () => {
      expect(lateRequests).toHaveLength(1);
      await expect(lateRequests[0]).resolves.toHaveProperty(
        "message",
        expect.stringContaining("Unstubbed fetch"),
      );
    });
  });
});
