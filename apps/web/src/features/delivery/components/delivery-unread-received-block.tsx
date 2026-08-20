"use client";

import type { Nullable, ReceivedUnreadView } from "@app/shared";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";

import { buildDeliveryUnreadReceived } from "../model/history-outcome";
import { DeliveryBookCover, DeliveryBookLink } from "./delivery-book-preview";

type DeliveryUnreadReceivedBlockProps = {
  isLoading: boolean;
  unreadReceived: Nullable<ReceivedUnreadView>;
};

export function DeliveryUnreadReceivedBlock({
  isLoading,
  unreadReceived,
}: DeliveryUnreadReceivedBlockProps) {
  const t = useTranslations("delivery.history.unreadReceived");

  const model = buildDeliveryUnreadReceived({
    labels: {
      booksCount: (count) => t("booksCount", { count }),
      inQueue: (count) => t("inQueue", { count }),
    },
    unreadReceived,
  });

  if (isLoading) {
    return (
      <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
        <div aria-busy className="flex flex-col gap-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </LibraryOverviewSection>
    );
  }

  if (model === null) {
    return null;
  }

  if (model.books.kind === "none") {
    return (
      <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">{t("empty.text")}</p>
          <p className="text-xs text-muted-foreground">{t("empty.helper")}</p>
        </div>
      </LibraryOverviewSection>
    );
  }

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg leading-tight font-semibold text-ink">
            {model.booksCountText}
          </p>
          {model.inQueueText === null ? null : (
            <p className="text-xs text-muted-foreground">{model.inQueueText}</p>
          )}
        </div>

        {model.books.kind === "single" ? (
          <DeliveryBookLink book={model.books.book} />
        ) : (
          <span className="flex shrink-0 items-center -space-x-3">
            {model.books.covers.map((book) => (
              <DeliveryBookCover book={book} key={book.id} sizeClass="h-12 w-9 ring-2 ring-card" />
            ))}
          </span>
        )}
      </div>
    </LibraryOverviewSection>
  );
}
