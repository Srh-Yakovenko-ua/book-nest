import type { MarkBoughtInput } from "@app/shared";

import type {
  OwnershipChangePatch,
  OwnershipPurchaseInfoPatch,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

export type OwnershipTransitionInput =
  | { date: string; fields: MarkBoughtInput; kind: "mark-bought" }
  | { kind: "mark-owned" }
  | { kind: "remove-from-wishlist" }
  | { kind: "remove-owned" }
  | { kind: "want-to-buy" };

export function computeOwnershipChange(input: OwnershipTransitionInput): OwnershipChangePatch {
  switch (input.kind) {
    case "mark-bought":
      return {
        book: { ownershipStatus: "owned" },
        purchaseInfo: buildMarkBoughtPatch(input),
      };
    case "mark-owned":
      return { book: { ownershipStatus: "owned" }, purchaseInfo: "delete" };
    case "remove-from-wishlist":
      return { book: { ownershipStatus: "none" }, purchaseInfo: "delete" };
    case "remove-owned":
      return { book: { ownershipStatus: "none" }, purchaseInfo: "delete" };
    case "want-to-buy":
      return { book: { ownershipStatus: "want_to_buy" } };
    default: {
      const _exhaustiveCheck: never = input;
      return _exhaustiveCheck;
    }
  }
}

function buildMarkBoughtPatch({
  date,
  fields,
}: {
  date: string;
  fields: MarkBoughtInput;
}): OwnershipPurchaseInfoPatch {
  const patch: OwnershipPurchaseInfoPatch = { purchasedAt: parseIsoDate(date) };
  if (fields.storeName !== undefined) {
    patch.storeName = fields.storeName;
  }
  if (fields.expectedPrice !== undefined) {
    patch.expectedPrice = fields.expectedPrice;
  }
  if (fields.currency !== undefined) {
    patch.currency = fields.currency;
  }
  return patch;
}
