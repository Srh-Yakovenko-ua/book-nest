import type { LoanDirection } from "@app/shared";

import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";
import {
  BooksControllerListOwnerItem,
  BooksControllerListSort,
} from "@/shared/api/generated/model";

type LoanCandidateBooksPage = z.infer<typeof PaginatedBooksSchema>;

const LOAN_CANDIDATE_PAGE_SIZE = 20;

const LOAN_CANDIDATE_OWNERSHIP = {
  borrowed: [BooksControllerListOwnerItem.none, BooksControllerListOwnerItem.want_to_buy],
  lent: [BooksControllerListOwnerItem.owned],
} as const satisfies Record<LoanDirection, readonly BooksControllerListOwnerItem[]>;

const EMPTY_LIST_PARAMS = {
  ageCategory: [],
  author: [],
  format: [],
  genre: [],
  language: [],
  publisher: [],
  status: [],
  tag: [],
} satisfies Partial<BooksControllerListParams>;

export function useLoanCandidateBooks({
  direction,
  search,
}: {
  direction: LoanDirection;
  search: string;
}) {
  const trimmed = search.trim();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: LoanCandidateBooksPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LoanCandidateBooksPage> => {
      const response = await booksControllerList({
        ...EMPTY_LIST_PARAMS,
        owner: [...LOAN_CANDIDATE_OWNERSHIP[direction]],
        pageNumber: pageParam,
        pageSize: LOAN_CANDIDATE_PAGE_SIZE,
        sort: BooksControllerListSort.title_asc,
        ...(trimmed.length > 0 ? { q: trimmed } : {}),
      });
      return PaginatedBooksSchema.parse(response);
    },
    queryKey: ["/api/books", "loan-candidates", direction, trimmed],
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
