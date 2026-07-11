import { describe, expect, it, vi } from "vitest";

import { makeSeriesBookView } from "../../series/model/series.fixtures";
import { computeSeriesSequenceHint } from "./series-sequence-hint";

vi.mock("@/i18n/navigation", () => ({
  getPathname: () => "",
  Link: () => null,
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("computeSeriesSequenceHint", () => {
  it("points forward to the next unread book when current is earlier", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({
      id: "b2",
      partNumber: 2,
      readingStatus: "want_to_read",
      title: "Тенета війни",
    });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b1",
        currentPartNumber: 1,
        totalBooks: 3,
      }),
    ).toEqual({ book: b2, kind: "afterAdded" });
  });

  it("marks the current book when it is the first unread one", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "want_to_read" });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b2",
        currentPartNumber: 2,
        totalBooks: 3,
      }),
    ).toEqual({ kind: "current" });
  });

  it("points back to an earlier unread book when current is later", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({
      id: "b2",
      partNumber: 2,
      readingStatus: "want_to_read",
      title: "Тенета війни",
    });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b3",
        currentPartNumber: 3,
        totalBooks: 3,
      }),
    ).toEqual({ book: b2, kind: "beforeAdded" });
  });

  it("marks the current book when every earlier book is finished", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "finished" });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b3",
        currentPartNumber: 3,
        totalBooks: 3,
      }),
    ).toEqual({ kind: "current" });
  });

  it("reports completion when all books are finished", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "finished" });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "finished" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b3",
        currentPartNumber: 3,
        totalBooks: 3,
      }),
    ).toEqual({ kind: "completed" });
  });

  it("points forward to a missing book when current is earlier", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "finished" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2],
        currentId: "b2",
        currentPartNumber: 2,
        totalBooks: 5,
      }),
    ).toEqual({ kind: "afterMissing", number: 3 });
  });

  it("points back to a missing book when current is later", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "finished" });
    const b4 = makeSeriesBookView({ id: "b4", partNumber: 4, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b4],
        currentId: "b4",
        currentPartNumber: 4,
        totalBooks: 5,
      }),
    ).toEqual({ kind: "beforeMissing", number: 3 });
  });

  it("treats reading as not finished", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "reading" });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "not_started" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b2",
        currentPartNumber: 2,
        totalBooks: 3,
      }),
    ).toEqual({ kind: "current" });
  });

  it("treats an earlier dnf book as still blocking", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "dnf" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "want_to_read" });
    const b3 = makeSeriesBookView({ id: "b3", partNumber: 3, readingStatus: "not_started" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, b3],
        currentId: "b2",
        currentPartNumber: 2,
        totalBooks: 3,
      }),
    ).toEqual({ book: b1, kind: "beforeAdded" });
  });

  it("marks the current book when it is a dnf first incomplete", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "dnf" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2],
        currentId: "b2",
        currentPartNumber: 2,
        totalBooks: 2,
      }),
    ).toEqual({ kind: "current" });
  });

  it("points forward with an unknown total when current is earlier", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2],
        currentId: "b1",
        currentPartNumber: 1,
        totalBooks: null,
      }),
    ).toEqual({ book: b2, kind: "afterAdded" });
  });

  it("returns none with an unknown total when all books are finished", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "finished" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2],
        currentId: "b1",
        currentPartNumber: 1,
        totalBooks: null,
      }),
    ).toEqual({ kind: "none" });
  });

  it("treats an unnumbered current book as sorting last", () => {
    const b1 = makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" });
    const b2 = makeSeriesBookView({ id: "b2", partNumber: 2, readingStatus: "want_to_read" });
    const bx = makeSeriesBookView({ id: "bx", partNumber: null, readingStatus: "want_to_read" });

    expect(
      computeSeriesSequenceHint({
        books: [b1, b2, bx],
        currentId: "bx",
        currentPartNumber: null,
        totalBooks: null,
      }),
    ).toEqual({ book: b2, kind: "beforeAdded" });
  });
});
