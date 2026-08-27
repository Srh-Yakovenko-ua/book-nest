import { describe, expect, it, vi } from "vitest";

import { BOUNDED_LIST, reportTruncation } from "./bounded-list.js";

describe("reportTruncation", () => {
  it("returns the rows untouched and stays quiet below the cap", () => {
    const log = { warn: vi.fn() };
    const rows = [{ id: "a" }, { id: "b" }];

    expect(reportTruncation({ context: { userId: "u1" }, log, rows, scope: "notes" })).toBe(rows);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("warns with the scope, the cap and the context when a page hits the cap", () => {
    const log = { warn: vi.fn() };
    const rows = Array.from({ length: BOUNDED_LIST.maxRows }, (_, index) => ({
      id: String(index),
    }));

    reportTruncation({ context: { bookId: "b1", userId: "u1" }, log, rows, scope: "book notes" });

    expect(log.warn).toHaveBeenCalledWith(
      { bookId: "b1", cap: BOUNDED_LIST.maxRows, userId: "u1" },
      "book notes truncated at the cap",
    );
  });
});
