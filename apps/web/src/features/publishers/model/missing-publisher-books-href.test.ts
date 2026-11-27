import { describe, expect, it } from "vitest";

import { buildMissingPublisherBooksHref } from "./missing-publisher-books-href";

describe("buildMissingPublisherBooksHref", () => {
  it("opens the library filtered to books without a publisher", () => {
    expect(buildMissingPublisherBooksHref()).toBe("/books?publisherPresence=missing");
  });
});
