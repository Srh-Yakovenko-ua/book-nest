import { OwnershipStatusSchema } from "@app/shared";
import { z } from "zod";

export const BookCreateOwnershipStatusSchema = OwnershipStatusSchema.extract([
  "owned",
  "want_to_buy",
  "borrowed_from_someone",
  "lent_to_someone",
]);

export type BookCreateOwnershipStatus = z.infer<typeof BookCreateOwnershipStatusSchema>;

export const BOOK_CREATE_PATH = "/books/new";

export function bookCreateHref({
  ownershipStatus,
}: {
  ownershipStatus: BookCreateOwnershipStatus;
}): string {
  return `${BOOK_CREATE_PATH}?${new URLSearchParams({ ownershipStatus }).toString()}`;
}
