import type { GenreView } from "@app/shared";

import type { GenreModel } from "../../../generated/prisma/models.js";

export function toGenreView(genre: GenreModel): GenreView {
  return {
    groupKey: genre.groupKey,
    groupName: genre.groupName,
    id: genre.id,
    isDefault: genre.isDefault,
    key: genre.key,
    name: genre.name,
  };
}
