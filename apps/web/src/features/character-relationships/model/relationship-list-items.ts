import type {
  CharacterRelationshipListItemView,
  PaginatedCharacterRelationshipListView,
} from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

type RelationshipListPages = InfiniteData<PaginatedCharacterRelationshipListView, number>;

type RelationshipListResult = {
  items: CharacterRelationshipListItemView[];
  totalCount: number;
};

export function toRelationshipListResult(data: RelationshipListPages): RelationshipListResult {
  const seenIds = new Set<string>();
  const items = data.pages
    .flatMap((page) => page.items)
    .filter((item) => {
      const isDuplicate = seenIds.has(item.relationship.id);
      seenIds.add(item.relationship.id);
      return !isDuplicate;
    });

  return { items, totalCount: data.pages[0]?.totalCount ?? items.length };
}
