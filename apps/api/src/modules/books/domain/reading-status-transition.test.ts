import { describe, expect, it } from "vitest";

import { computeReadingStatusChange } from "./reading-status-transition.js";

const DATE = "2026-02-01";
const PARSED_DATE = new Date("2026-02-01T00:00:00.000Z");
const EXISTING_START = new Date("2026-01-10T00:00:00.000Z");

const CLEARED_MARKERS = {
  abandonedAt: null,
  finishedAt: null,
  note: null,
  pausedAt: null,
  rating: null,
  startedAt: null,
};

describe("computeReadingStatusChange not_started", () => {
  it("produces an empty progress patch when no progress row exists", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: false,
      pagesCount: null,
      targetStatus: "not_started",
    });

    expect(patch).toEqual({ book: { readingStatus: "not_started" }, progress: {} });
  });

  it("stays empty even with resetProgress when no progress row exists", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: false,
      pagesCount: 300,
      resetProgress: true,
      targetStatus: "not_started",
    });

    expect(patch.progress).toEqual({});
  });

  it("clears every conflicting marker but keeps the current page when resetProgress is false", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      resetProgress: false,
      targetStatus: "not_started",
    });

    expect(patch.progress).toEqual(CLEARED_MARKERS);
  });

  it("also clears the current page when resetProgress is true", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      resetProgress: true,
      targetStatus: "not_started",
    });

    expect(patch.progress).toEqual({ ...CLEARED_MARKERS, currentPage: null });
  });
});

describe("computeReadingStatusChange want_to_read", () => {
  it("produces an empty progress patch when no progress row exists", () => {
    const patch = computeReadingStatusChange({
      currentPage: 50,
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: false,
      pagesCount: 300,
      targetStatus: "want_to_read",
    });

    expect(patch).toEqual({ book: { readingStatus: "want_to_read" }, progress: {} });
  });

  it("clears every conflicting marker when a progress row exists", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "want_to_read",
    });

    expect(patch.progress).toEqual(CLEARED_MARKERS);
  });
});

describe("computeReadingStatusChange reading", () => {
  it("keeps the existing started date and clears the other markers", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "reading",
    });

    expect(patch).toEqual({
      book: { readingStatus: "reading" },
      progress: {
        abandonedAt: null,
        finishedAt: null,
        note: null,
        pausedAt: null,
        startedAt: EXISTING_START,
      },
    });
  });

  it("uses the request date as the started date when none exists yet", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: false,
      pagesCount: 300,
      targetStatus: "reading",
    });

    expect(patch.progress.startedAt).toEqual(PARSED_DATE);
  });

  it("records the current page when provided", () => {
    const patch = computeReadingStatusChange({
      currentPage: 42,
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "reading",
    });

    expect(patch.progress).toEqual({
      abandonedAt: null,
      currentPage: 42,
      finishedAt: null,
      note: null,
      pausedAt: null,
      startedAt: EXISTING_START,
    });
  });
});

describe("computeReadingStatusChange rereading", () => {
  it("mirrors the reading branch, resolving the started date from the existing one", () => {
    const patch = computeReadingStatusChange({
      currentPage: 10,
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "rereading",
    });

    expect(patch).toEqual({
      book: { readingStatus: "rereading" },
      progress: {
        abandonedAt: null,
        currentPage: 10,
        finishedAt: null,
        note: null,
        pausedAt: null,
        startedAt: EXISTING_START,
      },
    });
  });
});

describe("computeReadingStatusChange paused", () => {
  it("stamps the paused date, carries the current page and note, and clears the rest", () => {
    const patch = computeReadingStatusChange({
      currentPage: 120,
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      note: "taking a break",
      pagesCount: 300,
      targetStatus: "paused",
    });

    expect(patch).toEqual({
      book: { readingStatus: "paused" },
      progress: {
        abandonedAt: null,
        currentPage: 120,
        finishedAt: null,
        note: "taking a break",
        pausedAt: PARSED_DATE,
      },
    });
  });

  it("nulls the note when none is provided", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "paused",
    });

    expect(patch.progress).toEqual({
      abandonedAt: null,
      finishedAt: null,
      note: null,
      pausedAt: PARSED_DATE,
    });
  });

  it("passes an explicit null note through to the patch", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: true,
      note: null,
      pagesCount: 300,
      targetStatus: "paused",
    });

    expect(patch.progress).toEqual({
      abandonedAt: null,
      finishedAt: null,
      note: null,
      pausedAt: PARSED_DATE,
    });
  });
});

describe("computeReadingStatusChange finished", () => {
  it("snaps the current page to the page count and clears conflicting markers", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: EXISTING_START,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "finished",
    });

    expect(patch).toEqual({
      book: { readingStatus: "finished" },
      progress: {
        abandonedAt: null,
        currentPage: 300,
        finishedAt: PARSED_DATE,
        note: null,
        pausedAt: null,
      },
    });
  });

  it("omits the current page when the page count is unknown", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: true,
      pagesCount: null,
      targetStatus: "finished",
    });

    expect(patch.progress).toEqual({
      abandonedAt: null,
      finishedAt: PARSED_DATE,
      note: null,
      pausedAt: null,
    });
  });

  it("records the rating when provided", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: true,
      pagesCount: 300,
      rating: 8.5,
      targetStatus: "finished",
    });

    expect(patch.progress).toEqual({
      abandonedAt: null,
      currentPage: 300,
      finishedAt: PARSED_DATE,
      note: null,
      pausedAt: null,
      rating: 8.5,
    });
  });
});

describe("computeReadingStatusChange dnf", () => {
  it("stamps the abandoned date, carries the current page and note, and clears the rest", () => {
    const patch = computeReadingStatusChange({
      currentPage: 75,
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: true,
      note: "not for me",
      pagesCount: 300,
      targetStatus: "dnf",
    });

    expect(patch).toEqual({
      book: { readingStatus: "dnf" },
      progress: {
        abandonedAt: PARSED_DATE,
        currentPage: 75,
        finishedAt: null,
        note: "not for me",
        pausedAt: null,
      },
    });
  });

  it("nulls the note when none is provided", () => {
    const patch = computeReadingStatusChange({
      date: DATE,
      existingStartedAt: null,
      hasExistingProgress: true,
      pagesCount: 300,
      targetStatus: "dnf",
    });

    expect(patch.progress).toEqual({
      abandonedAt: PARSED_DATE,
      finishedAt: null,
      note: null,
      pausedAt: null,
    });
  });
});
