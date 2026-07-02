import type { WantToBuyInput } from "@app/shared";

import type {
  OwnershipChangePatch,
  OwnershipPurchaseInfoPatch,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

export type OwnershipTransitionInput =
  | { date: string; kind: "mark-bought" }
  | { fields: WantToBuyInput; kind: "want-to-buy" }
  | { kind: "mark-owned" }
  | { kind: "remove-owned" };

export function computeOwnershipChange(input: OwnershipTransitionInput): OwnershipChangePatch {
  switch (input.kind) {
    case "mark-bought":
      return {
        book: { ownershipStatus: "owned" },
        purchaseInfo: { purchasedAt: parseIsoDate(input.date) },
      };
    case "mark-owned":
      return { book: { ownershipStatus: "owned" }, purchaseInfo: "delete" };
    case "remove-owned":
      return { book: { ownershipStatus: "none" }, purchaseInfo: "delete" };
    case "want-to-buy": {
      const purchaseInfo = buildWantToBuyOverwrite(input.fields);
      return purchaseInfo === undefined
        ? { book: { ownershipStatus: "want_to_buy" } }
        : { book: { ownershipStatus: "want_to_buy" }, purchaseInfo };
    }
    default: {
      const _exhaustiveCheck: never = input;
      return _exhaustiveCheck;
    }
  }
}

function buildWantToBuyOverwrite(fields: WantToBuyInput): OwnershipPurchaseInfoPatch | undefined {
  const hasAnyField =
    fields.currency !== undefined ||
    fields.expectedPrice !== undefined ||
    fields.note !== undefined ||
    fields.storeName !== undefined ||
    fields.storeUrl !== undefined;
  if (!hasAnyField) {
    return undefined;
  }

  return {
    currency: fields.currency ?? null,
    expectedPrice: fields.expectedPrice ?? null,
    note: fields.note ?? null,
    purchasedAt: null,
    storeName: fields.storeName ?? null,
    storeUrl: fields.storeUrl ?? null,
  };
}
