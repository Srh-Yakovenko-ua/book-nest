import type { TagColor, TagsMostUsedLeader, TagType, TagUsageDistribution } from "@app/shared";

export type TaggedEntityCounts = {
  taggedBooksCount: number;
  taggedCharactersCount: number;
  totalBooksCount: number;
  totalCharactersCount: number;
};

export type TagsSummaryAggregate = {
  colorCounts: Partial<Record<TagColor, number>>;
  leaders: TagsMostUsedLeader[];
  leadersCount: number;
  topUsageCount: number;
  totalTagsCount: number;
  typeCounts: Partial<Record<TagType, number>>;
  usageDistribution: TagUsageDistribution;
};

export type TagUsageAggregate = {
  booksCount: number;
  charactersCount: number;
  color: TagColor;
  description: null | string;
  id: string;
  name: string;
  type: TagType;
  usageCount: number;
};
