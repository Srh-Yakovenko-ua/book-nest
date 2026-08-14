"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type {
  DeliveryOrderBookModel,
  DeliveryOrderCardModel,
  DeliveryShipmentGroupModel,
} from "../model/order-card-model";

type BookRowProps = {
  book: DeliveryOrderBookModel;
  onCancel: () => void;
  onEdit: () => void;
  onReceive: () => void;
  onToggleSelect: () => void;
  receivePending: boolean;
  selected: boolean;
};

type DeliveryOrderCardProps = {
  model: DeliveryOrderCardModel;
  onCancelBook: (bookId: string) => void;
  onEditBook: (bookId: string) => void;
  onReceiveBook: (book: DeliveryOrderBookModel) => void;
  onReceiveShipment: (bookIds: string[]) => void;
  onToggleSelectBook: (bookId: string) => void;
  receivePendingBookId: Nullable<string>;
  selectedBookIds: ReadonlySet<string>;
};

type ShipmentSectionProps = {
  group: DeliveryShipmentGroupModel;
  onCancelBook: (bookId: string) => void;
  onEditBook: (bookId: string) => void;
  onReceiveBook: (book: DeliveryOrderBookModel) => void;
  onReceiveShipment: (bookIds: string[]) => void;
  onToggleSelectBook: (bookId: string) => void;
  receivePendingBookId: Nullable<string>;
  selectedBookIds: ReadonlySet<string>;
};

export function DeliveryOrderCard({
  model,
  onCancelBook,
  onEditBook,
  onReceiveBook,
  onReceiveShipment,
  onToggleSelectBook,
  receivePendingBookId,
  selectedBookIds,
}: DeliveryOrderCardProps) {
  const t = useTranslations("delivery.card");

  const metaText = [model.orderNumber, model.orderDateText]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-accent text-icon">
            <UiIcon name="store" size={16} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="truncate font-heading text-base leading-tight font-semibold text-ink">
              {model.storeName}
            </h3>
            {metaText === "" ? null : (
              <p className="truncate text-xs text-muted-foreground">{metaText}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <p className="text-xs text-muted-foreground">
            {t("booksInTransit", { count: model.booksCount })}
          </p>
          {model.totalText === null ? null : (
            <p className="text-sm font-semibold text-ink">
              <span className="font-normal text-muted-foreground">{t("orderTotal")}: </span>
              {model.totalText}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {model.shipments.map((group) => (
          <ShipmentSection
            group={group}
            key={group.id ?? "not-shipped"}
            onCancelBook={onCancelBook}
            onEditBook={onEditBook}
            onReceiveBook={onReceiveBook}
            onReceiveShipment={onReceiveShipment}
            onToggleSelectBook={onToggleSelectBook}
            receivePendingBookId={receivePendingBookId}
            selectedBookIds={selectedBookIds}
          />
        ))}
      </div>
    </article>
  );
}

function BookRow({
  book,
  onCancel,
  onEdit,
  onReceive,
  onToggleSelect,
  receivePending,
  selected,
}: BookRowProps) {
  const t = useTranslations("delivery.card");

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border bg-card p-2.5 transition-[border-color,box-shadow] duration-200",
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
      )}
    >
      <span className="mt-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md">
        <Checkbox
          aria-label={t("selectAria", { title: book.title })}
          checked={selected}
          onCheckedChange={onToggleSelect}
        />
      </span>

      <Link
        className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft sm:w-12"
        href={book.bookHref}
      >
        {book.coverSrc === undefined ? (
          <span className="grid h-full w-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={16} />
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
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink transition-colors hover:text-primary"
          href={book.bookHref}
        >
          {book.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{book.authorName}</p>
        {book.seriesText === null ? null : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon className="shrink-0" name="layers" size={13} />
            <span className="truncate">{book.seriesText}</span>
          </p>
        )}
      </div>

      {book.priceText === null ? null : (
        <p className="shrink-0 text-sm font-semibold whitespace-nowrap text-ink">
          {book.priceText}
        </p>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("actionsAria", { title: book.title })}
            className="shrink-0"
            size="icon"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem disabled={receivePending} onSelect={onReceive}>
            <UiIcon name="check-circle" size={16} />
            {t("receive")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <UiIcon name="edit" size={16} />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={book.bookHref}>
              <UiIcon name="book" size={16} />
              {t("openBook")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onCancel} variant="destructive">
            <UiIcon name="x-circle" size={16} />
            {t("cancel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-foreground/90">{value}</dd>
    </div>
  );
}

function ShipmentSection({
  group,
  onCancelBook,
  onEditBook,
  onReceiveBook,
  onReceiveShipment,
  onToggleSelectBook,
  receivePendingBookId,
  selectedBookIds,
}: ShipmentSectionProps) {
  const t = useTranslations("delivery.card");
  const tCommon = useTranslations("common");

  const hasDetails =
    group.serviceName !== null ||
    group.trackingNumber !== null ||
    group.expectedDateText !== null ||
    group.pickupUntilText !== null ||
    group.trackingHref !== null;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge entry={group.badge} />
        {group.id === null ? (
          <span className="text-xs text-muted-foreground">{t("notShipped")}</span>
        ) : null}
      </div>

      {hasDetails ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {group.serviceName === null ? null : (
            <InfoRow label={t("service")} value={group.serviceName} />
          )}
          {group.trackingNumber === null ? null : (
            <InfoRow label={t("trackingNumber")} value={group.trackingNumber} />
          )}
          {group.expectedDateText === null ? null : (
            <InfoRow label={t("expectedDate")} value={group.expectedDateText} />
          )}
          {group.pickupUntilText === null ? null : (
            <InfoRow label={t("pickupUntil")} value={group.pickupUntilText} />
          )}
          {group.trackingHref === null ? null : (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("tracking")}</dt>
              <dd>
                <a
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-sm text-primary underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  href={group.trackingHref}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <UiIcon className="shrink-0" name="external" size={14} />
                  <span className="truncate">{t("openTracking")}</span>
                  <span className="sr-only">{tCommon("opensInNewTab")}</span>
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : null}

      {group.note === null ? null : (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UiIcon name="note" size={13} />
            {t("note")}
          </span>
          <p className="text-sm break-words text-foreground/90">{group.note}</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {group.books.map((book) => (
          <li key={book.id}>
            <BookRow
              book={book}
              onCancel={() => onCancelBook(book.bookId)}
              onEdit={() => onEditBook(book.bookId)}
              onReceive={() => onReceiveBook(book)}
              onToggleSelect={() => onToggleSelectBook(book.bookId)}
              receivePending={receivePendingBookId === book.bookId}
              selected={selectedBookIds.has(book.bookId)}
            />
          </li>
        ))}
      </ul>

      <Button
        className="w-full"
        onClick={() => onReceiveShipment(group.books.map((book) => book.bookId))}
      >
        <UiIcon name="check-circle" size={16} />
        {t("receiveShipment", { count: group.books.length })}
      </Button>
    </section>
  );
}
