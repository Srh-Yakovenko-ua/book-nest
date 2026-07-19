import { describe, expect, it } from "vitest";

import type { ContentPosition } from "./reading-position.js";

import {
  buildReadingPositionGate,
  hasReaderReachedContent,
  isHiddenByReadingPosition,
} from "./reading-position.js";

const noPosition: ContentPosition = { audioSeconds: null, chapter: null, page: null };

describe("hasReaderReachedContent", () => {
  it("shows content with no declared position once the book is reached", () => {
    expect(hasReaderReachedContent({ content: noPosition, reader: { page: 3 } })).toBe(true);
  });

  it("does not gate anything when the reader declares no position", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: null, page: 200 };
    expect(hasReaderReachedContent({ content, reader: {} })).toBe(true);
  });

  it("reaches content when the reader page is at or past the content page", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: null, page: 30 };
    expect(hasReaderReachedContent({ content, reader: { page: 30 } })).toBe(true);
    expect(hasReaderReachedContent({ content, reader: { page: 31 } })).toBe(true);
  });

  it("masks content when the reader page is before the content page", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: null, page: 200 };
    expect(hasReaderReachedContent({ content, reader: { page: 3 } })).toBe(false);
  });

  it("prefers page over chapter and audioSeconds when both sides have a page", () => {
    const content: ContentPosition = { audioSeconds: 10, chapter: "5", page: 100 };
    expect(
      hasReaderReachedContent({
        content,
        reader: { audioSeconds: 9999, chapter: 999, page: 50 },
      }),
    ).toBe(false);
  });

  it("falls back to chapter when the reader has no page", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: "5", page: 100 };
    expect(hasReaderReachedContent({ content, reader: { chapter: 10 } })).toBe(true);
    expect(hasReaderReachedContent({ content, reader: { chapter: 4 } })).toBe(false);
  });

  it("falls back to audioSeconds when page and chapter are not common", () => {
    const content: ContentPosition = { audioSeconds: 600, chapter: null, page: null };
    expect(hasReaderReachedContent({ content, reader: { audioSeconds: 600 } })).toBe(true);
    expect(hasReaderReachedContent({ content, reader: { audioSeconds: 599 } })).toBe(false);
  });

  it("biases to mask when a non-numeric chapter cannot be compared", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: "Prologue", page: null };
    expect(hasReaderReachedContent({ content, reader: { chapter: 5 } })).toBe(false);
  });

  it("biases to mask when the sides share no comparable unit", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: null, page: 100 };
    expect(hasReaderReachedContent({ content, reader: { chapter: 10 } })).toBe(false);
  });

  it("compares a numeric chapter string against the reader chapter", () => {
    const content: ContentPosition = { audioSeconds: null, chapter: "20", page: null };
    expect(hasReaderReachedContent({ content, reader: { chapter: 3 } })).toBe(false);
    expect(hasReaderReachedContent({ content, reader: { chapter: 20 } })).toBe(true);
  });
});

describe("buildReadingPositionGate", () => {
  it("returns null when the reader position is undefined", () => {
    expect(buildReadingPositionGate({ contextBookId: "book", reader: undefined })).toBeNull();
  });

  it("returns null when the reader position has no declared unit", () => {
    expect(buildReadingPositionGate({ contextBookId: "book", reader: {} })).toBeNull();
  });

  it("builds a gate when the reader declares at least one unit", () => {
    expect(buildReadingPositionGate({ contextBookId: "book", reader: { page: 3 } })).toEqual({
      contextBookId: "book",
      reader: { page: 3 },
    });
  });
});

describe("isHiddenByReadingPosition", () => {
  const content: ContentPosition = { audioSeconds: null, chapter: null, page: 200 };

  it("never hides when there is no gate", () => {
    expect(isHiddenByReadingPosition({ content, contentBookId: "book", gate: null })).toBe(false);
  });

  it("never hides content outside the gated context book", () => {
    const gate = { contextBookId: "current", reader: { page: 3 } };
    expect(isHiddenByReadingPosition({ content, contentBookId: "earlier", gate })).toBe(false);
  });

  it("hides not-yet-reached content in the gated context book", () => {
    const gate = { contextBookId: "current", reader: { page: 3 } };
    expect(isHiddenByReadingPosition({ content, contentBookId: "current", gate })).toBe(true);
  });

  it("shows reached content in the gated context book", () => {
    const gate = { contextBookId: "current", reader: { page: 300 } };
    expect(isHiddenByReadingPosition({ content, contentBookId: "current", gate })).toBe(false);
  });
});
