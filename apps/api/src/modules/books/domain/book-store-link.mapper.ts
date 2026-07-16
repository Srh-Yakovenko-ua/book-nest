import type { BookStoreLinkView } from "@app/shared";

import { CurrencySchema } from "@app/shared";

import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";

export function toBookStoreLinkView(link: BookStoreLinkModel): BookStoreLinkView {
  return {
    bookId: link.bookId,
    createdAt: link.createdAt.toISOString(),
    currency: link.currency === null ? null : CurrencySchema.parse(link.currency),
    id: link.id,
    price: link.price === null ? null : link.price.toNumber(),
    storeName: link.storeName,
    updatedAt: link.updatedAt.toISOString(),
    url: link.url,
  };
}
