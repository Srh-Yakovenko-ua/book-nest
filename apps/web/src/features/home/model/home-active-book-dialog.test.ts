import { describe, expect, it } from "vitest";

import { homeActiveBookDialogTarget, openHomeActiveBookDialog } from "./home-active-book-dialog";

const BOOK_ID = "e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8a05";

describe("openHomeActiveBookDialog", () => {
  it("opens the progress dialog for the book", () => {
    expect(openHomeActiveBookDialog({ action: "progress", bookId: BOOK_ID })).toEqual({
      bookId: BOOK_ID,
      kind: "progress",
    });
  });

  it.each([["finished"], ["paused"]] as const)(
    "opens the status dialog that marks the book %s",
    (status) => {
      expect(openHomeActiveBookDialog({ action: status, bookId: BOOK_ID })).toEqual({
        bookId: BOOK_ID,
        kind: "status",
        status,
      });
    },
  );
});

describe("homeActiveBookDialogTarget", () => {
  it("holds the book the open dialog acts on", () => {
    expect(
      homeActiveBookDialogTarget(openHomeActiveBookDialog({ action: "paused", bookId: BOOK_ID })),
    ).toBe(BOOK_ID);
  });

  it("holds no book when the dialog is closed", () => {
    expect(homeActiveBookDialogTarget({ kind: "closed" })).toBeNull();
  });
});
