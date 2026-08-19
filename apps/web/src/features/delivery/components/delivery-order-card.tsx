"use client";

import type { ActiveShipmentStatus, Nullable } from "@app/shared";

import { SHIPMENT_ACTIVE_STATUSES } from "@app/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type {
  DeliveryOrderBookModel,
  DeliveryOrderCardModel,
  DeliveryShipmentGroupModel,
} from "../model/order-card-model";
import type { OrderShipmentAction } from "./order-shipment-action-dialog";

import { isSelectableShipment } from "../model/order-card-model";

type DeliveryOrderCardProps = {
  model: DeliveryOrderCardModel;
  onCancelBook: (bookId: string) => void;
  onChangeShipmentStatus: (shipmentId: string, status: ActiveShipmentStatus) => void;
  onEditBook: (book: DeliveryOrderBookModel) => void;
  onManage: (action: OrderShipmentAction) => void;
  onReceiveShipment: (shipmentId: string, bookCount: number) => void;
  onToggleSelectShipment: (shipmentId: string) => void;
  preparingEdit: boolean;
  revealedOrderId?: Nullable<string>;
  revealedShipmentId?: Nullable<string>;
  selectedShipmentIds: ReadonlySet<string>;
  selectionMode: boolean;
};

const INITIAL_BOOK_COUNT = 3;

type ShipmentNextStep =
  | { icon: UiIconName; kind: "receive"; labelKey: "receiveShipmentCompact" }
  | {
      icon: UiIconName;
      kind: "status";
      labelKey: "markInTransitCompact" | "markReadyForPickupCompact";
      status: ActiveShipmentStatus;
    };

const SHIPMENT_HEADER_SLOTS = {
  action: "max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-2 max-sm:h-11 max-sm:w-full",
  menu: "max-sm:col-start-2 max-sm:row-start-1",
} as const;

const SHIPMENT_NEXT_STEP = {
  in_transit: {
    icon: "store",
    kind: "status",
    labelKey: "markReadyForPickupCompact",
    status: "ready_for_pickup",
  },
  ordered: {
    icon: "truck",
    kind: "status",
    labelKey: "markInTransitCompact",
    status: "in_transit",
  },
  ready_for_pickup: { icon: "check-circle", kind: "receive", labelKey: "receiveShipmentCompact" },
} as const satisfies Record<ActiveShipmentStatus, ShipmentNextStep>;

type ShipmentSectionProps = {
  books: DeliveryOrderBookModel[];
  group: DeliveryShipmentGroupModel;
  index: number;
  onCancelBook: (bookId: string) => void;
  onChangeShipmentStatus: (shipmentId: string, status: ActiveShipmentStatus) => void;
  onEditBook: (book: DeliveryOrderBookModel) => void;
  onManage: (action: OrderShipmentAction) => void;
  onReceiveShipment: (shipmentId: string, bookCount: number) => void;
  onToggleSelectShipment: (shipmentId: string) => void;
  revealed: boolean;
  selected: boolean;
  selectionMode: boolean;
  shipmentCount: number;
};

export function DeliveryOrderCard({
  model,
  onCancelBook,
  onChangeShipmentStatus,
  onEditBook,
  onManage,
  onReceiveShipment,
  onToggleSelectShipment,
  preparingEdit,
  revealedOrderId = null,
  revealedShipmentId = null,
  selectedShipmentIds,
  selectionMode,
}: DeliveryOrderCardProps) {
  const t = useTranslations("delivery.card");
  const [expanded, setExpanded] = useState(false);
  const revealId = revealedOrderId ?? revealedShipmentId;
  const [handledRevealId, setHandledRevealId] = useState<Nullable<string>>(revealId);

  const revealsThisCard =
    revealedOrderId === model.id ||
    (revealedShipmentId !== null && carriesShipment(model, revealedShipmentId));

  if (revealId !== handledRevealId) {
    setHandledRevealId(revealId);
    if (revealsThisCard) {
      setExpanded(true);
    }
  }

  const visibleLimit = expanded ? model.booksCount : INITIAL_BOOK_COUNT;
  const { containerRef, contentRef } = useAnimatedHeight<HTMLDivElement>({
    contentKey: visibleLimit,
    expanded,
  });
  const hiddenCount = countHiddenBooks(model.shipments);
  const booksCountText = t("booksCount", { count: model.booksCount });
  const metaText = [model.orderNumber, model.orderDateText]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card max-sm:gap-3 max-sm:p-3",
        "motion-safe:transition-shadow motion-safe:duration-500",
        revealedOrderId === model.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      data-order-id={model.id}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-3">
        <div className="flex min-w-0 items-start gap-3 max-sm:col-start-1 max-sm:row-start-1">
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
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-start gap-2 max-sm:contents">
          <StatusBadge
            className="mt-0.5 max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-0 max-sm:max-w-full"
            entry={model.badge}
          />
          <div className="pt-0.5 text-right tabular-nums max-sm:col-start-2 max-sm:row-start-2 max-sm:min-w-0 max-sm:pt-0">
            <p className="font-heading text-lg leading-tight font-semibold text-ink">
              {model.totalText ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{booksCountText}</p>
            {model.incompleteTotal === null ? null : (
              <p className="mt-0.5 text-xs text-warning">
                {t("incompleteTotalCaption", {
                  priced: model.incompleteTotal.pricedItemsCount,
                  total: model.incompleteTotal.itemsCount,
                })}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("orderActionsAria")}
                className="max-sm:col-start-2 max-sm:row-start-1 max-sm:mt-0.5"
                loading={preparingEdit}
                size="icon"
                variant="ghost"
              >
                {preparingEdit ? null : <UiIcon name="more" size={18} />}
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

      {model.incompleteTotal === null ? null : (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          <UiIcon className="mt-0.5" name="alert-triangle" size={16} />
          {t("incompleteTotalWarning", {
            priced: model.incompleteTotal.pricedItemsCount,
            total: model.incompleteTotal.itemsCount,
          })}
        </p>
      )}

      <div
        className="overflow-hidden motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out"
        ref={containerRef}
      >
        <div className="flex flex-col gap-3" ref={contentRef}>
          {model.shipments.map((group, index) => (
            <ShipmentSection
              books={group.books.slice(0, visibleLimit)}
              group={group}
              index={index}
              key={group.id ?? "not-shipped"}
              onCancelBook={onCancelBook}
              onChangeShipmentStatus={onChangeShipmentStatus}
              onEditBook={onEditBook}
              onManage={onManage}
              onReceiveShipment={onReceiveShipment}
              onToggleSelectShipment={onToggleSelectShipment}
              revealed={group.id !== null && group.id === revealedShipmentId}
              selected={group.id !== null && selectedShipmentIds.has(group.id)}
              selectionMode={selectionMode}
              shipmentCount={model.shipments.length}
            />
          ))}
        </div>
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
}: {
  book: DeliveryOrderBookModel;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("delivery.card");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <div className="group flex min-h-20 items-center gap-3 py-3 transition-colors max-sm:min-h-0 max-sm:py-2">
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
          className="line-clamp-2 font-heading text-sm font-semibold text-ink hover:text-primary max-sm:leading-tight sm:line-clamp-1"
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

function carriesShipment(model: DeliveryOrderCardModel, shipmentId: string): boolean {
  return model.shipments.some((group) => group.id === shipmentId);
}

function countHiddenBooks(shipments: DeliveryShipmentGroupModel[]): number {
  return shipments.reduce(
    (hidden, group) => hidden + Math.max(0, group.books.length - INITIAL_BOOK_COUNT),
    0,
  );
}

function ShipmentSection({
  books,
  group,
  index,
  onCancelBook,
  onChangeShipmentStatus,
  onEditBook,
  onManage,
  onReceiveShipment,
  onToggleSelectShipment,
  revealed,
  selected,
  selectionMode,
  shipmentCount,
}: ShipmentSectionProps) {
  const t = useTranslations("delivery.card");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("books.deliveryStatus.labels");
  const shipmentTitle =
    shipmentCount === 1 ? t("shipment") : t("shipmentNumber", { number: index + 1 });
  const activeShipment = isSelectableShipment(group)
    ? { id: group.id, nextStep: SHIPMENT_NEXT_STEP[group.status], status: group.status }
    : null;
  const statusText =
    activeShipment === null || group.badge.value === activeShipment.status
      ? null
      : tStatus(activeShipment.status);
  const pickupUntilText =
    activeShipment?.status === "ready_for_pickup" ? group.pickupUntilText : null;
  const metadata = [
    { label: t("service"), value: group.serviceName },
    { label: t("trackingNumber"), value: group.trackingNumber },
  ].filter(({ value }) => value !== null);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border transition-colors max-sm:border-0",
        selected ? "bg-primary/5" : "bg-card",
        "motion-safe:transition-shadow motion-safe:duration-500",
        revealed && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      data-shipment-id={group.id ?? undefined}
    >
      <div className="flex items-start justify-between gap-3 bg-secondary/30 p-3 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-2 max-sm:gap-y-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-start">
            <div className="contents max-sm:flex max-sm:w-full max-sm:min-w-0 max-sm:items-center max-sm:gap-2">
              {selectionMode && activeShipment !== null ? (
                <Checkbox
                  aria-label={t("selectShipmentAria", { title: shipmentTitle })}
                  checked={selected}
                  onCheckedChange={() => onToggleSelectShipment(activeShipment.id)}
                />
              ) : null}
              <UiIcon className="shrink-0 text-icon" name="package" size={16} />
              <h4 className="min-w-0 truncate font-heading text-sm font-semibold text-ink">
                {shipmentTitle}
              </h4>
            </div>
            <div className="contents max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-2">
              <StatusBadge className="max-sm:max-w-full" entry={group.badge} />
              {statusText === null ? null : (
                <span className="text-xs text-muted-foreground">{statusText}</span>
              )}
              {group.id === null ? (
                <span className="text-xs text-muted-foreground">{t("notShipped")}</span>
              ) : null}
            </div>
          </div>
          {metadata.length === 0 && group.trackingHref === null ? null : (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground max-sm:flex-col max-sm:items-start max-sm:gap-y-2">
              {metadata.map(({ label, value }, metadataIndex) => (
                <span className="contents" key={label}>
                  {metadataIndex === 0 ? null : (
                    <span aria-hidden className="max-sm:hidden">
                      ·
                    </span>
                  )}
                  <span className="min-w-0 break-words">
                    <span className="sr-only">{label}: </span>
                    {value}
                  </span>
                </span>
              ))}
              {group.trackingHref === null ? null : (
                <>
                  {metadata.length === 0 ? null : (
                    <span aria-hidden className="max-sm:hidden">
                      ·
                    </span>
                  )}
                  <a
                    className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2"
                    href={group.trackingHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <UiIcon name="external" size={14} />
                    {t("openTracking")}
                    <span className="sr-only">{tCommon("opensInNewTab")}</span>
                  </a>
                </>
              )}
            </p>
          )}
          {group.expectedDateText === null ? null : (
            <p className="text-xs text-muted-foreground">
              {t("expectedDeliveryDate", { date: group.expectedDateText })}
            </p>
          )}
          {pickupUntilText === null ? null : (
            <p className="text-xs text-muted-foreground">
              {t("pickupUntil", { date: pickupUntilText })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 max-sm:contents">
          {activeShipment === null ? (
            <Button
              aria-label={t("shipmentActionsAria", { title: shipmentTitle })}
              className={SHIPMENT_HEADER_SLOTS.menu}
              disabled
              size="icon"
              variant="ghost"
            >
              <UiIcon name="more" size={18} />
            </Button>
          ) : (
            <>
              <Button
                className={SHIPMENT_HEADER_SLOTS.action}
                onClick={() =>
                  activeShipment.nextStep.kind === "receive"
                    ? onReceiveShipment(activeShipment.id, group.books.length)
                    : onChangeShipmentStatus(activeShipment.id, activeShipment.nextStep.status)
                }
                size="sm"
                variant={activeShipment.nextStep.kind === "receive" ? "default" : "secondary"}
              >
                <UiIcon name={activeShipment.nextStep.icon} size={16} />
                {t(activeShipment.nextStep.labelKey)}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("shipmentActionsAria", { title: shipmentTitle })}
                    className={SHIPMENT_HEADER_SLOTS.menu}
                    size="icon"
                    variant="ghost"
                  >
                    <UiIcon name="more" size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-max whitespace-nowrap">
                  <DropdownMenuItem
                    onSelect={() => onReceiveShipment(activeShipment.id, group.books.length)}
                  >
                    <UiIcon name="check-circle" size={16} />
                    {t("receiveShipmentMenu")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UiIcon name="truck" size={16} />
                      {t("statusMenu")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={activeShipment.status}>
                        {SHIPMENT_ACTIVE_STATUSES.map((option) => (
                          <DropdownMenuRadioItem
                            key={option}
                            onSelect={() => {
                              if (option === activeShipment.status) return;
                              onChangeShipmentStatus(activeShipment.id, option);
                            }}
                            value={option}
                          >
                            {tStatus(option)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
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
                onEdit={() => onEditBook(book)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
