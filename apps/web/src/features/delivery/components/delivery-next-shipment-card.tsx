"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";
import { Link } from "@/i18n/navigation";

import type {
  DeliveryNextShipmentBook,
  DeliveryNextShipmentCardModel,
} from "../model/next-shipment-card";

type DeliveryNextShipmentCardProps = {
  isLoading: boolean;
  model: Nullable<DeliveryNextShipmentCardModel>;
  onReveal: () => void;
  resetsFilters: boolean;
};

export function DeliveryNextShipmentCard({
  isLoading,
  model,
  onReveal,
  resetsFilters,
}: DeliveryNextShipmentCardProps) {
  const t = useTranslations("delivery.nextShipment");

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      {isLoading ? (
        <CardSkeleton />
      ) : model === null ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">{t("empty.text")}</p>
          <p className="text-xs text-muted-foreground">{t("empty.helper")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg leading-tight font-semibold text-ink">
              {model.relativeDayText}
            </p>
            <p className="text-xs text-muted-foreground">{model.expectedDateText}</p>
          </div>

          <dl className="flex flex-col gap-1.5 text-xs">
            <MetaRow icon="store" label={t("store")} value={model.storeName} />
            {model.serviceName === null ? null : (
              <MetaRow icon="truck" label={t("service")} value={model.serviceName} />
            )}
            {model.trackingText === null ? null : (
              <MetaRow icon="package" label={t("tracking")} mono value={model.trackingText} />
            )}
          </dl>

          <ShipmentBooks books={model.books} />

          {model.sameDayText === null ? null : (
            <p className="text-xs text-muted-foreground">{model.sameDayText}</p>
          )}

          <div className="flex flex-col gap-1">
            <Button className="w-full justify-between" onClick={onReveal} variant="secondary">
              {resetsFilters ? t("action.show") : t("action.open")}
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

function BookCover({ book, sizeClass }: { book: DeliveryNextShipmentBook; sizeClass: string }) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded bg-accent shadow-soft ${sizeClass}`}
    >
      {book.coverSrc === undefined ? (
        <span className="grid h-full place-items-center text-accent-foreground/70">
          <UiIcon name="book" size={14} />
        </span>
      ) : (
        <Image
          alt={book.title}
          className="object-cover"
          fill
          sizes="48px"
          src={book.coverSrc}
          unoptimized
        />
      )}
    </span>
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
  mono = false,
  value,
}: {
  icon: "package" | "store" | "truck";
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <UiIcon name={icon} size={14} />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className={`truncate text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function ShipmentBooks({ books }: { books: DeliveryNextShipmentCardModel["books"] }) {
  if (books.kind === "single") {
    return (
      <Link
        className="flex min-w-0 items-center gap-2.5 rounded-md no-underline transition-colors hover:bg-secondary"
        href={books.book.bookHref}
      >
        <BookCover book={books.book} sizeClass="h-14 w-10" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 font-heading text-sm leading-tight font-semibold text-ink">
            {books.book.title}
          </span>
          <span className="truncate text-xs text-muted-foreground">{books.book.authorName}</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex shrink-0 items-center -space-x-3">
        {books.covers.map((book) => (
          <BookCover book={book} key={book.id} sizeClass="h-12 w-9 ring-2 ring-card" />
        ))}
      </span>
      <span className="text-sm font-medium text-ink">{books.countText}</span>
    </div>
  );
}
