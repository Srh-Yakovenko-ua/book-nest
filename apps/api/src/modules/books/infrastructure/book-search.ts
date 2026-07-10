import type { Prisma } from "../../../generated/prisma/client.js";

type BookSearchConditionsInput = {
  search: string | undefined;
  searchGenreKeys?: string[];
};

export function buildBookSearchConditions({
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
    { authors: { some: { author: { name: { contains, mode: "insensitive" } } } } },
    {
      authors: {
        some: { author: { names: { some: { name: { contains, mode: "insensitive" } } } } },
      },
    },
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

  return conditions;
}
