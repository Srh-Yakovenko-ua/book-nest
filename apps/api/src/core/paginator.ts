import type { Paginator } from "@app/shared";

type BuildPaginatorInput<T> = {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
};

export function buildPaginator<T>({
  items,
  pageNumber,
  pageSize,
  totalCount,
}: BuildPaginatorInput<T>): Paginator<T> {
  return {
    items,
    page: pageNumber,
    pagesCount: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    pageSize,
    totalCount,
  };
}
