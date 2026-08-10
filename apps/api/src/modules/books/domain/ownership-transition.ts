import type { MarkBoughtInput, OwnershipStatus } from "@app/shared";

import type {
  OwnershipChangePatch,
  OwnershipPurchaseInfoPatch,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { buildBookOwnershipFields } from "./book-ownership-fields.js";

export type OwnershipTransitionInput = OwnershipTransition & {
  current: OwnershipStatus;
  now: Date;
};

type OwnershipTransition =
  | { date: string; fields: MarkBoughtInput; kind: "mark-bought" }
  | { kind: "mark-owned" }
  | { kind: "remove-from-wishlist" }
  | { kind: "remove-owned" }
  | { kind: "want-to-buy" };

const TRANSITION_TARGET_STATUS: Record<OwnershipTransition["kind"], OwnershipStatus> = {
  "mark-bought": "owned",
  "mark-owned": "owned",
  "remove-from-wishlist": "none",
  "remove-owned": "none",
  "want-to-buy": "want_to_buy",
};

export function computeOwnershipChange(input: OwnershipTransitionInput): OwnershipChangePatch {
  const book = buildBookOwnershipFields({
    current: input.current,
    next: TRANSITION_TARGET_STATUS[input.kind],
    now: input.now,
  });

  switch (input.kind) {
    case "mark-bought":
      return { book, purchaseInfo: buildMarkBoughtPatch(input) };
    case "mark-owned":
      return { book, purchaseInfo: "delete" };
    case "remove-from-wishlist":
      return { book, purchaseInfo: "delete" };
    case "remove-owned":
      return { book, purchaseInfo: "delete" };
    case "want-to-buy":
      return { book };
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
