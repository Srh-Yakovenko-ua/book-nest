import { describe, expect, it } from "vitest";

import { readingStatusTitleKey } from "./reading-status-title";

describe("readingStatusTitleKey", () => {
  it("maps a finished book to the reading-summary title", () => {
    expect(readingStatusTitleKey("finished")).toBe("summaryTitle");
  });

  it.each(["not_started", "want_to_read", "reading", "rereading", "paused", "dnf"] as const)(
    "maps %s to the reading-progress title",
    (status) => {
      expect(readingStatusTitleKey(status)).toBe("title");
    },
  );
});
