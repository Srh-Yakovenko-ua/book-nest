"use client";

import type { MouseEvent } from "react";

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

type PublisherPaginationProps = {
  onPageChange: (page: number) => void;
  page: number;
  pagesCount: number;
};

export function PublisherPagination({ onPageChange, page, pagesCount }: PublisherPaginationProps) {
  const t = useTranslations("publishers.pagination");

  if (pagesCount <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < pagesCount;

  const goTo = (next: number) => (event: MouseEvent) => {
    event.preventDefault();
    if (next >= 1 && next <= pagesCount && next !== page) onPageChange(next);
  };

  return (
    <Pagination aria-label={t("label")}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={!hasPrevious}
            className={hasPrevious ? undefined : "pointer-events-none opacity-40"}
            href="#"
            onClick={goTo(page - 1)}
            text={t("previous")}
          />
        </PaginationItem>

        {pageItems(page, pagesCount).map((item, index) =>
          item === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                aria-label={t("goToPage", { page: item })}
                href="#"
                isActive={item === page}
                onClick={goTo(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            aria-disabled={!hasNext}
            className={hasNext ? undefined : "pointer-events-none opacity-40"}
            href="#"
            onClick={goTo(page + 1)}
            text={t("next")}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function pageItems(page: number, pagesCount: number): ("gap" | number)[] {
  if (pagesCount <= 7) {
    return Array.from({ length: pagesCount }, (_, index) => index + 1);
  }

  const items: ("gap" | number)[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pagesCount - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pagesCount - 1) items.push("gap");
  items.push(pagesCount);

  return items;
}
