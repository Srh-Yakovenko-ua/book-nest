import type { TagCatalogListItem, TagCatalogView } from "@app/shared";

import { TagTypeSchema } from "@app/shared";

import type { TagModel } from "../../../generated/prisma/models.js";
import type { TagUsageAggregate } from "./tag-usage.js";

import { toNullableIsoDateTime } from "../../../core/iso-date.js";

export function toTagCatalogListItem(tag: TagUsageAggregate): TagCatalogListItem {
  return {
    booksCount: tag.booksCount,
    charactersCount: tag.charactersCount,
    color: tag.color,
    description: tag.description,
    id: tag.id,
    name: tag.name,
    type: tag.type,
    usageCount: tag.usageCount,
  };
}

export function toTagCatalogView(tag: TagModel): TagCatalogView {
  return {
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    description: tag.description,
    id: tag.id,
    lastUsedAt: toNullableIsoDateTime(tag.lastUsedAt),
    name: tag.name,
    normalizedName: tag.normalizedName,
    type: TagTypeSchema.parse(tag.type),
    updatedAt: tag.updatedAt.toISOString(),
  };
}
