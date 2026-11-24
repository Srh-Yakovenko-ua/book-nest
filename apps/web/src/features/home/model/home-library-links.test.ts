import { describe, expect, it } from "vitest";

import { HOME_LIBRARY_LINKS, homeBookHref } from "./home-library-links";

describe("HOME_LIBRARY_LINKS", () => {
  it("opens the catalogue filtered to reading and rereading for the reading count", () => {
    expect(HOME_LIBRARY_LINKS.counts.reading).toBe("/books?status=reading,rereading");
  });

  it("opens the catalogue filtered to finished books for the finished count", () => {
    expect(HOME_LIBRARY_LINKS.counts.finished).toBe("/books?status=finished");
  });

  it("opens the favorites page for the favorites count", () => {
    expect(HOME_LIBRARY_LINKS.counts.favorites).toBe("/favorites");
  });

  it("opens the unfiltered catalogue for the total count", () => {
    expect(HOME_LIBRARY_LINKS.counts.total).toBe("/books");
  });

  it("opens the new book form for adding a book", () => {
    expect(HOME_LIBRARY_LINKS.addBook).toBe("/books/new");
  });
});

describe("homeBookHref", () => {
  it("links to the book page", () => {
    expect(homeBookHref("6a1f3c2e-9b8d-4e7a-8c5b-1d2e3f4a5b6c")).toBe(
      "/books/6a1f3c2e-9b8d-4e7a-8c5b-1d2e3f4a5b6c",
    );
  });
});
