import type { TagCatalogView, TagStatsView, TagView } from "@app/shared";

import { TagTypeSchema } from "@app/shared";

import type { TagModel } from "../../../generated/prisma/models.js";

export function toTagCatalogView(tag: TagModel): TagCatalogView {
  return {
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    description: tag.description,
    id: tag.id,
    lastUsedAt: tag.lastUsedAt === null ? null : tag.lastUsedAt.toISOString(),
    name: tag.name,
    normalizedName: tag.normalizedName,
    type: TagTypeSchema.parse(tag.type),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

export function toTagStatsView({
  booksCount,
  tag,
}: {
  booksCount: number;
  tag: TagModel;
}): TagStatsView {
  return {
    booksCount,
    color: tag.color,
    id: tag.id,
    lastUsedAt: tag.lastUsedAt === null ? null : tag.lastUsedAt.toISOString(),
    name: tag.name,
    normalizedName: tag.normalizedName,
    type: TagTypeSchema.parse(tag.type),
  };
}

export function toTagView(tag: TagModel): TagView {
  return {
    id: tag.id,
    name: tag.name,
  };
}
