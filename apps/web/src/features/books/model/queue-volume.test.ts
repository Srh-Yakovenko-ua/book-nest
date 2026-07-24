import type { BookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeBookView } from "../components/book-details.fixtures";
import { queueVolumeGapReason } from "./queue-volume";

function bookWith(overrides: Partial<BookView>): BookView {
  return makeBookView({ readingStatus: "want_to_read", ...overrides });
}

function progressAt(currentPage: number): BookView["readingProgress"] {
  return {
    abandonedAt: null,
    currentPage,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
  };
}

describe("queueVolumeGapReason", () => {
  it("asks for a page count when the book has none", () => {
    expect(queueVolumeGapReason(bookWith({ pagesCount: null }))).toBe("missing_page_count");
  });

  it("asks for a page count when the formats list is empty", () => {
    expect(queueVolumeGapReason(bookWith({ formats: [], pagesCount: null }))).toBe(
      "missing_page_count",
    );
  });

  it("skips audiobook-only books without a page count", () => {
    expect(queueVolumeGapReason(bookWith({ formats: ["audiobook"], pagesCount: null }))).toBeNull();
  });

  it("still asks for a page count when an audiobook has another format", () => {
    expect(
      queueVolumeGapReason(bookWith({ formats: ["audiobook", "paper"], pagesCount: null })),
    ).toBe("missing_page_count");
  });

  it("skips books marked as having no stable page count", () => {
    expect(
      queueVolumeGapReason(
        bookWith({ formats: [], pagesCount: null, pagesCountUnavailable: true }),
      ),
    ).toBeNull();
  });

  it("skips books with a closed reading status", () => {
    expect(
      queueVolumeGapReason(bookWith({ pagesCount: null, readingStatus: "finished" })),
    ).toBeNull();
    expect(queueVolumeGapReason(bookWith({ pagesCount: null, readingStatus: "dnf" }))).toBeNull();
  });

  it("flags inconsistent progress when the current page exceeds the page count", () => {
    expect(
      queueVolumeGapReason(
        bookWith({ pagesCount: 200, readingProgress: progressAt(300), readingStatus: "reading" }),
      ),
    ).toBe("invalid_progress");
  });

  it("ignores leftover progress in statuses that do not track it", () => {
    expect(
      queueVolumeGapReason(
        bookWith({
          pagesCount: 200,
          readingProgress: progressAt(300),
          readingStatus: "want_to_read",
        }),
      ),
    ).toBeNull();
  });

  it("accepts progress that exactly matches the page count", () => {
    expect(
      queueVolumeGapReason(
        bookWith({ pagesCount: 200, readingProgress: progressAt(200), readingStatus: "reading" }),
      ),
    ).toBeNull();
  });

  it("prefers the stored page count over the unavailable flag", () => {
    expect(
      queueVolumeGapReason(
        bookWith({
          pagesCount: 200,
          pagesCountUnavailable: true,
          readingProgress: progressAt(300),
          readingStatus: "reading",
        }),
      ),
    ).toBe("invalid_progress");
  });
});
