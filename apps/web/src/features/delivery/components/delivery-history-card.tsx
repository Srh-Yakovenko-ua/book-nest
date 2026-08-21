"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/status-badge";

import type {
  HistoryBookModel,
  HistoryOrderCardModel,
  HistoryShipmentGroupModel,
} from "../model/history-order-card-model";

import { ORDER_CARD_LAYOUT } from "../model/order-card-model";
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

type DeliveryHistoryCardProps = {
  model: HistoryOrderCardModel;
  revealedOrderId?: Nullable<string>;
  revealedShipmentId?: Nullable<string>;
  search: string;
};

export function DeliveryHistoryCard({
  model,
  revealedOrderId = null,
  revealedShipmentId = null,
  search,
}: DeliveryHistoryCardProps) {
  const t = useTranslations("delivery.card");

  const revealsThisCard =
    revealedOrderId === model.id ||
    (revealedShipmentId !== null && carriesShipment(model, revealedShipmentId));
  const books = useExpandableBooks({
    booksCount: model.booksCount,
    hiddenCount: countHiddenBooks(model.shipments),
    initiallyExpanded: model.revealsSearchMatch,
    revealKey: revealedOrderId ?? revealedShipmentId ?? search,
    revealsThisCard: model.revealsSearchMatch || revealsThisCard,
  });

  return (
    <OrderCard
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
          <HistoryShipmentSection
            books={group.books.slice(0, books.visibleLimit)}
            group={group}
            index={index}
            key={group.id ?? "not-shipped"}
            revealed={group.id !== null && group.id === revealedShipmentId}
            shipmentCount={model.shipments.length}
          />
        ))}
      </OrderCardBooksRegion>
    </OrderCard>
  );
}

function BookFootnote({ book }: { book: HistoryBookModel }) {
  const tHistory = useTranslations("delivery.history.card");

  if (book.terminalText === null && book.cancelReason === null) return null;

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      {book.terminalText === null ? null : <span>{book.terminalText}</span>}
      {book.terminalText === null || book.cancelReason === null ? null : <span aria-hidden>·</span>}
      {book.cancelReason === null ? null : (
        <span className="min-w-0 break-words">
          <span className="sr-only">{tHistory("cancelReason")}: </span>
          {book.cancelReason}
        </span>
      )}
    </p>
  );
}

function carriesShipment(model: HistoryOrderCardModel, shipmentId: string): boolean {
  return model.shipments.some((group) => group.id === shipmentId);
}

function countHiddenBooks(shipments: HistoryShipmentGroupModel[]): number {
  return shipments.reduce(
    (hidden, group) => hidden + Math.max(0, group.books.length - ORDER_CARD_LAYOUT.bookLimit),
    0,
  );
}

function HistoryShipmentSection({
  books,
  group,
  index,
  revealed,
  shipmentCount,
}: {
  books: HistoryBookModel[];
  group: HistoryShipmentGroupModel;
  index: number;
  revealed: boolean;
  shipmentCount: number;
}) {
  const t = useTranslations("delivery.card");
  const tHistory = useTranslations("delivery.history.card");
  const shipmentTitle =
    shipmentCount === 1 ? t("shipment") : t("shipmentNumber", { number: index + 1 });

  return (
    <OrderShipmentSection
      badge={
        <div className="contents max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-2">
          {group.badge === null ? null : (
            <StatusBadge className="max-sm:max-w-full" entry={group.badge} />
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
            <OrderBookRow book={book} footnote={<BookFootnote book={book} />} />
          )}
        />
      }
      details={
        <>
          {group.terminalText === null ? null : (
            <p className="text-xs font-medium text-foreground/90">{group.terminalText}</p>
          )}
          {group.expectedText === null ? null : (
            <p className="text-xs text-muted-foreground">{group.expectedText}</p>
          )}
          {group.cancelReason === null ? null : (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <UiIcon className="mt-0.5 shrink-0 text-error" name="x-circle" size={13} />
              <span className="min-w-0 break-words">
                <span className="sr-only">{tHistory("cancelReason")}: </span>
                {group.cancelReason}
              </span>
            </p>
          )}
          <OrderCardNote label={t("note")} text={group.note} tone="inline" />
        </>
      }
      metadata={[
        { label: t("service"), value: group.serviceName },
        { label: t("trackingNumber"), value: group.trackingNumber },
      ].flatMap(({ label, value }) => (value === null ? [] : [{ label, value }]))}
      openTrackingLabel={t("openTracking")}
      revealed={revealed}
      shipmentId={group.id}
      title={shipmentTitle}
      trackingHref={group.trackingHref}
    />
  );
}
