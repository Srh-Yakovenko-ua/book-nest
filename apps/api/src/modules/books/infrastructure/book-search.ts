import { normalizeSearch } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

const MIN_SEARCH_LENGTH = 2;
const ISBN_FRAGMENT_PATTERN = /^\d+$/;

type BookSearchConditionsInput = {
  includeDedication?: boolean;
  search: string | undefined;
  searchGenreKeys?: string[];
};

export function buildBookSearchConditions({
  includeDedication,
  search,
  searchGenreKeys,
}: BookSearchConditionsInput): Prisma.BookWhereInput[] | undefined {
  if (search === undefined) {
    return undefined;
  }

  const contains = search;
  const conditions: Prisma.BookWhereInput[] = [
    { title: { contains, mode: "insensitive" } },
    { originalTitle: { contains, mode: "insensitive" } },
    ...buildAuthorSearchConditions(search),
    { series: { name: { contains, mode: "insensitive" } } },
    { publisher: { name: { contains, mode: "insensitive" } } },
    { publisher: { names: { some: { name: { contains, mode: "insensitive" } } } } },
    { tags: { some: { tag: { name: { contains, mode: "insensitive" } } } } },
    { translator: { contains, mode: "insensitive" } },
    { illustrator: { contains, mode: "insensitive" } },
  ];

  const isbnQuery = search.replace(/[\s-]/g, "");
  if (isbnQuery.length > 0) {
    conditions.push({ isbn: { contains: isbnQuery, mode: "insensitive" } });
  }
  if (searchGenreKeys !== undefined && searchGenreKeys.length > 0) {
    conditions.push({ genres: { hasSome: searchGenreKeys } });
  }
  if (includeDedication === true) {
    conditions.push({ dedication: { contains, mode: "insensitive" } });
  }

  return conditions;
}

export function buildBookTextSearchConditions(search: string): Prisma.BookWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  return [{ title: contains }, { originalTitle: contains }, ...buildAuthorSearchConditions(search)];
}

export function normalizeSearchQuery(value: string | undefined): string | undefined {
  const collapsed = normalizeSearch(value);
  if (collapsed === undefined) {
    return undefined;
  }
  if (collapsed.length < MIN_SEARCH_LENGTH && !isIsbnFragment(collapsed)) {
    return undefined;
  }
  return collapsed;
}

function buildAuthorSearchConditions(search: string): Prisma.BookWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  return [
    { authors: { some: { author: { name: contains } } } },
    { authors: { some: { author: { names: { some: { name: contains } } } } } },
  ];
}

function isIsbnFragment(value: string): boolean {
  return ISBN_FRAGMENT_PATTERN.test(value.replace(/[\s-]/g, ""));
}
