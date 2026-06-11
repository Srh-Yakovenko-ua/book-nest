import type { AuthorView } from "@app/shared";

import type { AuthorModel } from "../../../generated/prisma/models.js";

export function toAuthorView(author: AuthorModel): AuthorView {
  return {
    id: author.id,
    isCustom: author.userId !== null,
    name: author.name,
  };
}
