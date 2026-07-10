import type { CustomListCard, MediaView } from "@app/shared";

import type { BookListCard } from "../infrastructure/lists.repository.js";

type ToCustomListCardInput = {
  list: BookListCard;
  previewCovers: MediaView[];
};

export function toCustomListCard({ list, previewCovers }: ToCustomListCardInput): CustomListCard {
  return {
    bookCount: list._count.items,
    createdAt: list.createdAt.toISOString(),
    description: list.description,
    id: list.id,
    name: list.name,
    previewCovers,
    updatedAt: list.updatedAt.toISOString(),
  };
}
