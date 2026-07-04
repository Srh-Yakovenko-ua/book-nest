import { describe, expect, it } from "vitest";

import { computeReadingProgressChange } from "./reading-progress-transition.js";

const DATE = "2026-02-01";
const PARSED_DATE = new Date("2026-02-01T00:00:00.000Z");
const EXISTING_START = new Date("2026-01-10T00:00:00.000Z");

describe("computeReadingProgressChange plain update", () => {
  it("records the page and the update date without touching the status when already reading", () => {
    const patch = computeReadingProgressChange({
      currentPage: 120,
      currentStatus: "reading",
      existingStartedAt: EXISTING_START,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch).toEqual({
      book: null,
      progress: { currentPage: 120, lastProgressUpdateAt: PARSED_DATE },
    });
  });

  it("never auto-changes a paused book on a plain progress update", () => {
    const patch = computeReadingProgressChange({
      currentPage: 120,
      currentStatus: "paused",
      existingStartedAt: EXISTING_START,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch.book).toBeNull();
  });

  it("never auto-changes a dnf book on a plain progress update", () => {
    const patch = computeReadingProgressChange({
      currentPage: 120,
      currentStatus: "dnf",
      existingStartedAt: EXISTING_START,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch.book).toBeNull();
  });

  it("never auto-changes a finished book on a plain progress update", () => {
    const patch = computeReadingProgressChange({
      currentPage: 120,
      currentStatus: "finished",
      existingStartedAt: EXISTING_START,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch.book).toBeNull();
  });
});

describe("computeReadingProgressChange auto start", () => {
  it("promotes a not_started book with pages read to reading and stamps the start date", () => {
    const patch = computeReadingProgressChange({
      currentPage: 30,
      currentStatus: "not_started",
      existingStartedAt: null,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch).toEqual({
      book: { readingStatus: "reading" },
      progress: { currentPage: 30, lastProgressUpdateAt: PARSED_DATE, startedAt: PARSED_DATE },
    });
  });

  it("promotes a want_to_read book with pages read to reading", () => {
    const patch = computeReadingProgressChange({
      currentPage: 30,
      currentStatus: "want_to_read",
      existingStartedAt: null,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch.book).toEqual({ readingStatus: "reading" });
  });

  it("keeps an existing start date rather than overwriting it on auto start", () => {
    const patch = computeReadingProgressChange({
      currentPage: 30,
      currentStatus: "not_started",
      existingStartedAt: EXISTING_START,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch.progress.startedAt).toEqual(EXISTING_START);
  });

  it("does not auto start when the page is still zero", () => {
    const patch = computeReadingProgressChange({
      currentPage: 0,
      currentStatus: "not_started",
      existingStartedAt: null,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch.book).toBeNull();
    expect(patch.progress).toEqual({ currentPage: 0, lastProgressUpdateAt: PARSED_DATE });
  });
});

describe("computeReadingProgressChange markAsFinished", () => {
  it("forces the page to the page count and finishes the book when a page count exists", () => {
    const patch = computeReadingProgressChange({
      currentPage: 120,
      currentStatus: "reading",
      existingStartedAt: EXISTING_START,
      markAsFinished: true,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch).toEqual({
      book: { readingStatus: "finished" },
      progress: { currentPage: 300, finishedAt: PARSED_DATE, lastProgressUpdateAt: PARSED_DATE },
    });
  });

  it("keeps the supplied page when finishing a book with an unknown page count", () => {
    const patch = computeReadingProgressChange({
      currentPage: 120,
      currentStatus: "reading",
      existingStartedAt: EXISTING_START,
      markAsFinished: true,
      pagesCount: null,
      updateDate: DATE,
    });

    expect(patch.progress).toEqual({
      currentPage: 120,
      finishedAt: PARSED_DATE,
      lastProgressUpdateAt: PARSED_DATE,
    });
  });

  it("stamps both the start and finished dates when finishing straight from not_started", () => {
    const patch = computeReadingProgressChange({
      currentPage: 300,
      currentStatus: "not_started",
      existingStartedAt: null,
      markAsFinished: true,
      pagesCount: 300,
      updateDate: DATE,
    });

    expect(patch).toEqual({
      book: { readingStatus: "finished" },
      progress: {
        currentPage: 300,
        finishedAt: PARSED_DATE,
        lastProgressUpdateAt: PARSED_DATE,
        startedAt: PARSED_DATE,
      },
    });
  });
});
