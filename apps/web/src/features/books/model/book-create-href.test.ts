import { describe, expect, it } from "vitest";

import { bookCreateHref, BookCreateOwnershipStatusSchema } from "./book-create-href";

describe("bookCreateHref", () => {
  it.each([
    ["owned", "/books/new?ownershipStatus=owned"],
    ["want_to_buy", "/books/new?ownershipStatus=want_to_buy"],
    ["borrowed_from_someone", "/books/new?ownershipStatus=borrowed_from_someone"],
    ["lent_to_someone", "/books/new?ownershipStatus=lent_to_someone"],
  ] as const)("opens the create form preset to %s", (ownershipStatus, href) => {
    expect(bookCreateHref({ ownershipStatus })).toBe(href);
  });
});

describe("BookCreateOwnershipStatusSchema", () => {
  it.each(["owned", "want_to_buy", "borrowed_from_someone", "lent_to_someone"])(
    "accepts %s",
    (status) => {
      expect(BookCreateOwnershipStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it.each(["in_transit", "none", "garbage", ""])("rejects %s", (status) => {
    expect(BookCreateOwnershipStatusSchema.safeParse(status).success).toBe(false);
  });
});
