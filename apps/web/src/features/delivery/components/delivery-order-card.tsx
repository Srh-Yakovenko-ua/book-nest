"use client";

import { isActiveShipmentStatus } from "@app/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

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
import type { OrderShipmentAction } from "./order-shipment-action-dialog";

type DeliveryOrderCardProps = {
  model: DeliveryOrderCardModel;
  onCancelBook: (bookId: string) => void;
  onEditBook: (bookId: string) => void;
  onManage: (action: OrderShipmentAction) => void;
  onReceiveShipment: (shipmentId: string, bookCount: number) => void;
  onToggleSelectBook: (bookId: string) => void;
  selectedBookIds: ReadonlySet<string>;
  selectionMode: boolean;
};

const INITIAL_BOOK_COUNT = 4;

type ShipmentSectionProps = {
  books: DeliveryOrderBookModel[];
  group: DeliveryShipmentGroupModel;
  index: number;
  onCancelBook: (bookId: string) => void;
  onEditBook: (bookId: string) => void;
  onManage: (action: OrderShipmentAction) => void;
  onReceiveShipment: (shipmentId: string, bookCount: number) => void;
  onToggleSelectBook: (bookId: string) => void;
  selectedBookIds: ReadonlySet<string>;
  selectionMode: boolean;
  shipmentCount: number;
};

export function DeliveryOrderCard({
  model,
  onCancelBook,
  onEditBook,
  onManage,
  onReceiveShipment,
  onToggleSelectBook,
  selectedBookIds,
  selectionMode,
}: DeliveryOrderCardProps) {
  const t = useTranslations("delivery.card");
  const [expanded, setExpanded] = useState(false);
  const visibleLimit = expanded ? model.booksCount : INITIAL_BOOK_COUNT;
  const visibleBooks = takeVisibleBooks(model.shipments, visibleLimit);
  const hiddenCount = Math.max(0, model.booksCount - INITIAL_BOOK_COUNT);
  const booksCountText = t("booksCount", { count: model.booksCount });
  const metaText = [model.orderNumber, model.orderDateText]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-accent text-icon">
            <UiIcon name="store" size={17} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="truncate font-heading text-base leading-tight font-semibold text-ink">
              {model.storeName}
            </h3>
            {metaText === "" ? null : (
              <p className="truncate font-mono text-xs text-muted-foreground">{metaText}</p>
            )}
            <StatusBadge entry={model.badge} />
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="pt-0.5 text-right tabular-nums">
            <p className="font-heading text-lg leading-tight font-semibold text-ink">
              {model.totalText ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{booksCountText}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t("orderActionsAria")} size="icon" variant="ghost">
                <UiIcon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max whitespace-nowrap">
              <DropdownMenuItem onSelect={() => onManage({ kind: "edit-order", order: model })}>
                <UiIcon name="edit" size={16} />
                {t("editOrder")}
              </DropdownMenuItem>
              {model.shipments.some(({ id }) => id === null) ? (
                <DropdownMenuItem onSelect={() => onManage({ kind: "add-shipment", order: model })}>
                  <UiIcon name="plus" size={16} />
                  {t("addShipment")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {model.shipments.map((group, index) => {
          const books = visibleBooks[index] ?? [];
          return (
            <ShipmentSection
              books={books}
              group={group}
              index={index}
              key={group.id ?? "not-shipped"}
              onCancelBook={onCancelBook}
              onEditBook={onEditBook}
              onManage={onManage}
              onReceiveShipment={onReceiveShipment}
              onToggleSelectBook={onToggleSelectBook}
              selectedBookIds={selectedBookIds}
              selectionMode={selectionMode}
              shipmentCount={model.shipments.length}
            />
          );
        })}
      </div>

      {hiddenCount > 0 ? (
        <Button
          className="self-center"
          onClick={() => setExpanded((value) => !value)}
          variant="ghost"
        >
          <UiIcon name={expanded ? "chevron-up" : "chevron-down"} size={16} />
          {expanded ? t("collapseBooks") : t("showMoreBooks", { count: hiddenCount })}
        </Button>
      ) : null}
    </article>
  );
}

function BookRow({
  book,
  onCancel,
  onEdit,
  onToggleSelect,
  selected,
  selectionMode,
}: {
  book: DeliveryOrderBookModel;
  onCancel: () => void;
  onEdit: () => void;
  onToggleSelect: () => void;
  selected: boolean;
  selectionMode: boolean;
}) {
  const t = useTranslations("delivery.card");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <div
      className={cn(
        "group flex min-h-20 items-center gap-3 py-3 transition-colors",
        selected && "bg-primary/5",
      )}
    >
      {selectionMode ? (
        <Checkbox
          aria-label={t("selectAria", { title: book.title })}
          checked={selected}
          onCheckedChange={onToggleSelect}
        />
      ) : null}
      <Link
        className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-accent shadow-soft"
        href={book.bookHref}
      >
        {book.coverSrc === undefined ? (
          <span className="grid h-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={15} />
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
      <div className="min-w-0 flex-1">
        <Link
          className="line-clamp-1 font-heading text-sm font-semibold text-ink hover:text-primary"
          href={book.bookHref}
        >
          {book.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{book.authorName}</p>
        {book.series === null ? null : (
          <Link
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors hover:text-primary"
            href={book.series.href}
          >
            <UiIcon className="shrink-0 text-icon" name="layers" size={15} />
            <span className="min-w-0 truncate">
              {book.series.name}
              {book.series.positionLabel === null ? null : (
                <span className="text-muted-foreground"> · {book.series.positionLabel}</span>
              )}
            </span>
          </Link>
        )}
      </div>
      {book.priceText === null ? null : (
        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums">{book.priceText}</p>
      )}
      <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("actionsAria", { title: book.title })}
            className={cn(
              "shrink-0 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100 lg:focus-visible:opacity-100",
              isMenuOpen && "lg:opacity-100",
            )}
            size="icon"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-max whitespace-nowrap">
          <DropdownMenuItem asChild>
            <Link href={book.bookHref}>
              <UiIcon name="book" size={16} />
              {t("openBook")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <UiIcon name="edit" size={16} />
            {t("changePrice")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onCancel} variant="destructive">
            <UiIcon name="x-circle" size={16} />
            {t("cancelBook")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ShipmentSection({
  books,
  group,
  index,
  onCancelBook,
  onEditBook,
  onManage,
  onReceiveShipment,
  onToggleSelectBook,
  selectedBookIds,
  selectionMode,
  shipmentCount,
}: ShipmentSectionProps) {
  const t = useTranslations("delivery.card");
  const tCommon = useTranslations("common");
  const shipmentTitle =
    shipmentCount === 1 ? t("shipment") : t("shipmentNumber", { number: index + 1 });
  const shipmentId = group.id;
  const isActiveShipment = group.status !== null && isActiveShipmentStatus(group.status);
  const showCompactReceive = isActiveShipment && group.status === "ready_for_pickup";
  const metadata = [
    { label: t("service"), value: group.serviceName },
    { label: t("trackingNumber"), value: group.trackingNumber },
    { label: t("expectedDate"), value: group.expectedDateText },
  ].filter(({ value }) => value !== null);

  return (
    <section className="overflow-hidden rounded-md border border-border bg-secondary/30">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <UiIcon className="shrink-0 text-icon" name="package" size={16} />
            <h4 className="font-heading text-sm font-semibold text-ink">{shipmentTitle}</h4>
            <StatusBadge entry={group.badge} />
            {group.id === null ? (
              <span className="text-xs text-muted-foreground">{t("notShipped")}</span>
            ) : null}
          </div>
          {metadata.length === 0 ? null : (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              {metadata.map(({ label, value }, metadataIndex) => (
                <span className="contents" key={label}>
                  {metadataIndex === 0 ? null : <span aria-hidden>·</span>}
                  <span>
                    <span className="sr-only">{label}: </span>
                    {value}
                  </span>
                </span>
              ))}
            </p>
          )}
          {group.trackingHref === null ? null : (
            <a
              className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
              href={group.trackingHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              <UiIcon name="external" size={14} />
              {t("openTracking")}
              <span className="sr-only">{tCommon("opensInNewTab")}</span>
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shipmentId === null || !isActiveShipment ? (
            <Button
              aria-label={t("shipmentActionsAria", { title: shipmentTitle })}
              disabled
              size="icon"
              variant="ghost"
            >
              <UiIcon name="more" size={18} />
            </Button>
          ) : (
            <>
              {showCompactReceive ? (
                <Button onClick={() => onReceiveShipment(shipmentId, group.books.length)} size="sm">
                  <UiIcon name="check-circle" size={16} />
                  {t("receiveShipmentCompact")}
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("shipmentActionsAria", { title: shipmentTitle })}
                    size="icon"
                    variant="ghost"
                  >
                    <UiIcon name="more" size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-max whitespace-nowrap">
                  <DropdownMenuItem
                    onSelect={() => onReceiveShipment(shipmentId, group.books.length)}
                  >
                    <UiIcon name="check-circle" size={16} />
                    {t("receiveShipmentMenu")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onManage({ kind: "edit-shipment", shipment: group })}
                  >
                    <UiIcon name="edit" size={16} />
                    {t("editShipment")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onManage({ kind: "cancel-shipment", shipment: group })}
                    variant="destructive"
                  >
                    <UiIcon name="x-circle" size={16} />
                    {t("cancelShipment")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {books.length === 0 ? null : (
        <ul className="grid grid-cols-1 gap-x-5 border-t border-border px-3 lg:grid-cols-2">
          {books.map((book, bookIndex) => (
            <li
              className={cn(
                bookIndex > 0 && "border-t border-border",
                bookIndex === 1 && "lg:border-t-0",
              )}
              key={book.id}
            >
              <BookRow
                book={book}
                onCancel={() => onCancelBook(book.bookId)}
                onEdit={() => onEditBook(book.bookId)}
                onToggleSelect={() => onToggleSelectBook(book.bookId)}
                selected={selectedBookIds.has(book.bookId)}
                selectionMode={selectionMode}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function takeVisibleBooks(
  shipments: DeliveryShipmentGroupModel[],
  limit: number,
): DeliveryOrderBookModel[][] {
  let remaining = limit;
  return shipments.map((group) => {
    const books = group.books.slice(0, Math.max(0, remaining));
    remaining -= books.length;
    return books;
  });
}
