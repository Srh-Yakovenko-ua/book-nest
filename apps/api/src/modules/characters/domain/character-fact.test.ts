import { describe, expect, it } from "vitest";

import { ValidationError } from "../../../core/exceptions/errors.js";
import { assertFactPageWithinBook, toCharacterFactView } from "./character-fact.js";

function captureError(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("assertFactPageWithinBook", () => {
  it("accepts the last page of the book", () => {
    expect(
      captureError(() => assertFactPageWithinBook({ page: 300, pagesCount: 300 })),
    ).toBeUndefined();
  });

  it("rejects a page one past the end of the book with the page-exceeds code", () => {
    const error = captureError(() => assertFactPageWithinBook({ page: 301, pagesCount: 300 }));

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ code: "character_fact_page_exceeds_book", status: 422 });
  });

  it("accepts any page when the book has no page count", () => {
    expect(
      captureError(() => assertFactPageWithinBook({ page: 9000, pagesCount: null })),
    ).toBeUndefined();
  });

  it("accepts a fact without a page", () => {
    expect(
      captureError(() => assertFactPageWithinBook({ page: null, pagesCount: 10 })),
    ).toBeUndefined();
  });
});

describe("toCharacterFactView", () => {
  it("exposes exactly the seven view fields with ISO timestamps", () => {
    const view = toCharacterFactView({
      bookCharacterId: "22222222-2222-4222-8222-222222222222",
      chapter: "Chapter 3",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      id: "11111111-1111-4111-8111-111111111111",
      page: 42,
      text: "Keeps a wand of holly",
      title: "Wand",
      updatedAt: new Date("2026-03-02T11:30:15.250Z"),
    });

    expect(view).toStrictEqual({
      chapter: "Chapter 3",
      createdAt: "2026-03-01T10:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      page: 42,
      text: "Keeps a wand of holly",
      title: "Wand",
      updatedAt: "2026-03-02T11:30:15.250Z",
    });
  });
});
