"use client";

import type { ActiveShipmentStatus, Nullable } from "@app/shared";

import { SHIPMENT_ACTIVE_STATUSES } from "@app/shared";
import { useTranslations } from "next-intl";
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
import { cn } from "@/lib/utils";

import type {
  DeliveryOrderBookModel,
  DeliveryOrderCardModel,
  DeliveryShipmentGroupModel,
} from "../model/order-card-model";
import type { OrderShipmentAction } from "./order-shipment-action-dialog";

import { isSelectableShipment, ORDER_CARD_LAYOUT } from "../model/order-card-model";
import {
  OrderBookList,
  OrderBookRow,
  OrderCard,
  OrderCardBooksRegion,
  OrderCardExpandButton,
  OrderCardNote,
  OrderShipmentSection,
  useExpandableBooks,
} from "./order-card-parts";

type DeliveryOrderCardProps = {
  model: DeliveryOrderCardModel;
  onCancelBook: (book: DeliveryOrderBookModel) => void;
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
  onCancelBook: (book: DeliveryOrderBookModel) => void;
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

  const books = useExpandableBooks({
    booksCount: model.booksCount,
    hiddenCount: countHiddenBooks(model.shipments),
    revealKey: revealedOrderId ?? revealedShipmentId,
    revealsThisCard:
      revealedOrderId === model.id ||
      (revealedShipmentId !== null && carriesShipment(model, revealedShipmentId)),
  });

  return (
    <OrderCard
      actions={
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
      }
      badge={
        <StatusBadge
          className="mt-0.5 max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-0 max-sm:max-w-full"
          entry={model.badge}
        />
      }
      booksCountText={t("booksCount", { count: model.booksCount })}
      expandControl={
        <OrderCardExpandButton
          expanded={books.expanded}
          hiddenCount={books.hiddenCount}
          onToggle={books.toggle}
        />
      }
      metaText={[model.orderNumber, model.orderDateText]
        .filter((part) => part !== null)
        .join(" · ")}
      note={<OrderCardNote label={t("orderNote")} text={model.note} tone="block" />}
      orderId={model.id}
      revealed={revealedOrderId === model.id}
      storeName={model.storeName}
      totalText={model.totalText}
    >
      <OrderCardBooksRegion containerRef={books.containerRef} contentRef={books.contentRef}>
        {model.shipments.map((group, index) => (
          <ShipmentSection
            books={group.books.slice(0, books.visibleLimit)}
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
      </OrderCardBooksRegion>
    </OrderCard>
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
    <OrderBookRow
      actions={
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
      }
      book={book}
    />
  );
}

function carriesShipment(model: DeliveryOrderCardModel, shipmentId: string): boolean {
  return model.shipments.some((group) => group.id === shipmentId);
}

function countHiddenBooks(shipments: DeliveryShipmentGroupModel[]): number {
  return shipments.reduce(
    (hidden, group) => hidden + Math.max(0, group.books.length - ORDER_CARD_LAYOUT.bookLimit),
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

  return (
    <OrderShipmentSection
      actions={
        activeShipment === null ? (
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
        )
      }
      badge={
        <div className="contents max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-2">
          <StatusBadge className="max-sm:max-w-full" entry={group.badge} />
          {statusText === null ? null : (
            <span className="text-xs text-muted-foreground">{statusText}</span>
          )}
          {group.id === null ? (
            <span className="text-xs text-muted-foreground">{t("notShipped")}</span>
          ) : null}
        </div>
      }
      books={
        <OrderBookList
          books={books}
          renderBook={(book) => (
            <BookRow
              book={book}
              onCancel={() => onCancelBook(book)}
              onEdit={() => onEditBook(book)}
            />
          )}
        />
      }
      details={
        <>
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
          <OrderCardNote label={t("note")} text={group.note} tone="inline" />
        </>
      }
      leading={
        selectionMode && activeShipment !== null ? (
          <Checkbox
            aria-label={t("selectShipmentAria", { title: shipmentTitle })}
            checked={selected}
            onCheckedChange={() => onToggleSelectShipment(activeShipment.id)}
          />
        ) : null
      }
      metadata={[
        { label: t("service"), value: group.serviceName },
        { label: t("trackingNumber"), value: group.trackingNumber },
      ].flatMap(({ label, value }) => (value === null ? [] : [{ label, value }]))}
      openTrackingLabel={t("openTracking")}
      revealed={revealed}
      selected={selected}
      shipmentId={group.id}
      title={shipmentTitle}
      trackingHref={group.trackingHref}
    />
  );
}
