"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";

import type { DeliveryLatestReceiptCardModel } from "../model/latest-receipt-card";

import { DeliveryBookCoverStack, DeliveryBookLink } from "./delivery-book-preview";

type DeliveryLatestReceiptCardProps = {
  isLoading: boolean;
  model: Nullable<DeliveryLatestReceiptCardModel>;
  onReveal: () => void;
  resetsFilters: boolean;
};

export function DeliveryLatestReceiptCard({
  isLoading,
  model,
  onReveal,
  resetsFilters,
}: DeliveryLatestReceiptCardProps) {
  const t = useTranslations("delivery.history.latestReceipt");

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      {isLoading ? (
        <CardSkeleton />
      ) : model === null ? (
        <p className="text-sm font-medium text-ink">{t("empty.text")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg leading-tight font-semibold text-ink">
              {model.relativeDayText}
            </p>
            <p className="text-xs text-muted-foreground">{model.receivedDateText}</p>
          </div>

          <dl className="flex flex-col gap-1.5 text-xs">
            <MetaRow icon="store" label={t("store")} value={model.storeName} />
            {model.serviceName === null ? null : (
              <MetaRow icon="truck" label={t("service")} value={model.serviceName} />
            )}
          </dl>

          <ReceiptBooks books={model.books} />

          {model.sameDayText === null ? null : (
            <p className="text-xs text-muted-foreground">{model.sameDayText}</p>
          )}

          <div className="flex flex-col gap-1">
            <Button className="w-full justify-between" onClick={onReveal} variant="secondary">
              {t("action.open")}
              <UiIcon name="arrow-right" size={15} />
            </Button>
            {resetsFilters ? (
              <p className="text-xs text-muted-foreground">{t("action.resetHelper")}</p>
            ) : null}
          </div>
        </div>
      )}
    </LibraryOverviewSection>
  );
}

function CardSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-14 w-full rounded-md" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: "store" | "truck";
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <UiIcon name={icon} size={14} />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}

function ReceiptBooks({ books }: { books: DeliveryLatestReceiptCardModel["books"] }) {
  if (books.kind === "single") {
    return <DeliveryBookLink book={books.book} />;
  }

  return <DeliveryBookCoverStack books={books.covers} countText={books.countText} />;
}
