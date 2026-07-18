"use client";

import type { ReadingHistoryPaginationView } from "@app/shared";

import { useTranslations } from "next-intl";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type ReadingHistoryPaginationProps = {
  onPageChange: (page: number) => void;
  pagination: ReadingHistoryPaginationView;
};

export function ReadingHistoryPagination({
  onPageChange,
  pagination,
}: ReadingHistoryPaginationProps) {
  const t = useTranslations("books.details.readingHistory");

  if (pagination.totalPages <= 1) return null;

  const goTo = (page: number) => (event: React.MouseEvent) => {
    event.preventDefault();
    if (page >= 1 && page <= pagination.totalPages && page !== pagination.page) onPageChange(page);
  };

  return (
    <Pagination aria-label={t("paginationLabel")}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={!pagination.hasPreviousPage}
            className={pagination.hasPreviousPage ? undefined : "pointer-events-none opacity-40"}
            href="#"
            onClick={goTo(pagination.page - 1)}
            text={t("previous")}
          />
        </PaginationItem>

        {pageItems(pagination.page, pagination.totalPages).map((item, index) =>
          item === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                aria-label={t("goToPage", { page: item })}
                href="#"
                isActive={item === pagination.page}
                onClick={goTo(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            aria-disabled={!pagination.hasNextPage}
            className={pagination.hasNextPage ? undefined : "pointer-events-none opacity-40"}
            href="#"
            onClick={goTo(pagination.page + 1)}
            text={t("next")}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function pageItems(page: number, totalPages: number): ("gap" | number)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: ("gap" | number)[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);

  return items;
}
