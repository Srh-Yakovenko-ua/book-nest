import type { BookListView } from "@app/shared";

import type { BookListModel } from "../../../generated/prisma/models.js";

export function toBookListView(list: BookListModel): BookListView {
  return {
    description: list.description,
    id: list.id,
    name: list.name,
  };
}
