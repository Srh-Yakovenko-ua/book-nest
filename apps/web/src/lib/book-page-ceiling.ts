import type { Nullable } from "@app/shared";

export type BookPageCeiling = { max: number; source: "book" | "technical" };

export function bookPageCeiling({
  pagesCount,
  technicalMax,
}: {
  pagesCount: Nullable<number>;
  technicalMax: number;
}): BookPageCeiling {
  if (pagesCount === null || pagesCount < 1) return { max: technicalMax, source: "technical" };
  return { max: pagesCount, source: "book" };
}
