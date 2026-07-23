"use client";

import type { BookView, Currency, DeliveryStatus, DeliveryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { deliveryStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/http-client";
import { isHttpsUrl } from "@/lib/is-https-url";

import { useDeliveryHistory, useReceiveDelivery } from "../api/use-delivery";
import { todayIso } from "../model/reading-progress";
import { CancelDeliveryDialog } from "./cancel-delivery-dialog";
import { DeliveryDialog } from "./delivery-dialog";

type DeliveryBlockProps = {
  book: BookView;
};

export function DeliveryBlock({ book }: DeliveryBlockProps) {
  const t = useTranslations("books.details.delivery");
  const receiveDelivery = useReceiveDelivery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { active, latest, totalCount } = book.delivery;
  const visible = active !== null || totalCount > 0 || book.ownershipStatus === "in_transit";
  if (!visible) return null;

  function onReceive(deliveryId: string) {
    receiveDelivery.mutate(
      { deliveryId, id: book.id },
      {
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : t("toast.error")),
        onSuccess: () => toast.success(t("toast.received")),
      },
    );
  }

  return (
    <>
      <Card className="gap-4 shadow-detail-block">
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {active !== null ? (
            <ActiveDelivery
              delivery={active}
              onCancel={() => setCancelOpen(true)}
              onEdit={() => setEditOpen(true)}
              onReceive={() => onReceive(active.id)}
              receivePending={receiveDelivery.isPending}
            />
          ) : totalCount > 0 && latest !== null ? (
            <HistoryPreview bookId={book.id} latest={latest} totalCount={totalCount} />
          ) : (
            <RepairState onAdd={() => setCreateOpen(true)} />
          )}
        </CardContent>
      </Card>

      <DeliveryDialog book={book} mode="create" onOpenChange={setCreateOpen} open={createOpen} />
      {active === null ? null : (
        <>
          <DeliveryDialog
            book={book}
            delivery={active}
            mode="edit"
            onOpenChange={setEditOpen}
            open={editOpen}
          />
          <CancelDeliveryDialog
            book={book}
            delivery={active}
            onOpenChange={setCancelOpen}
            open={cancelOpen}
          />
        </>
      )}
    </>
  );
}

function ActiveDelivery({
  delivery,
  onCancel,
  onEdit,
  onReceive,
  receivePending,
}: {
  delivery: DeliveryView;
  onCancel: () => void;
  onEdit: () => void;
  onReceive: () => void;
  receivePending: boolean;
}) {
  const t = useTranslations("books.details.delivery");

  const delayed =
    delivery.expectedDeliveryDate !== null && delivery.expectedDeliveryDate < todayIso();
  const noExpectedDate = delivery.expectedDeliveryDate === null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <DeliveryStatusBadge status={delivery.status} />
        {delayed ? (
          <p className="text-sm font-medium text-destructive">{t("hints.delayed")}</p>
        ) : noExpectedDate ? (
          <p className="text-sm text-muted-foreground">{t("hints.noDate")}</p>
        ) : null}
      </div>

      <DeliveryDetails delivery={delivery} />

      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={onEdit} variant="secondary">
          <UiIcon name="edit" size={16} />
          {t("actions.edit")}
        </Button>
        <Button
          className="w-full"
          disabled={receivePending}
          loading={receivePending}
          onClick={onReceive}
        >
          <UiIcon name="check-circle" size={16} />
          {t("actions.receive")}
        </Button>
        <Button className="w-full" onClick={onCancel} variant="ghost">
          <UiIcon name="x-circle" size={16} />
          {t("actions.cancel")}
        </Button>
      </div>
    </>
  );
}

function DeliveryDetails({ delivery }: { delivery: DeliveryView }) {
  const t = useTranslations("books.details.delivery.fields");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const priceText = formatPrice(delivery.price, delivery.currency, locale);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
      <dl className="flex flex-col gap-2">
        {delivery.storeName === null ? null : (
          <InfoRow label={t("store")} value={delivery.storeName} />
        )}
        {delivery.orderDate === null ? null : (
          <InfoRow label={t("orderDate")} value={formatDate(delivery.orderDate, locale)} />
        )}
        {delivery.expectedDeliveryDate === null ? null : (
          <InfoRow
            label={t("expectedDeliveryDate")}
            value={formatDate(delivery.expectedDeliveryDate, locale)}
          />
        )}
        {delivery.orderNumber === null ? null : (
          <InfoRow label={t("orderNumber")} value={delivery.orderNumber} />
        )}
        {delivery.deliveryService === null ? null : (
          <InfoRow label={t("deliveryService")} value={delivery.deliveryService} />
        )}
        {delivery.trackingNumber === null ? null : (
          <InfoRow label={t("trackingNumber")} value={delivery.trackingNumber} />
        )}
        {delivery.trackingUrl === null ? null : (
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("trackingUrl")}</dt>
            <dd>
              {isHttpsUrl(delivery.trackingUrl) ? (
                <a
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-sm text-primary underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  href={delivery.trackingUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <UiIcon className="shrink-0" name="external" size={14} />
                  <span className="truncate">{delivery.trackingUrl}</span>
                  <span className="sr-only">{tCommon("opensInNewTab")}</span>
                </a>
              ) : (
                <span className="text-sm break-all text-foreground/90">{delivery.trackingUrl}</span>
              )}
            </dd>
          </div>
        )}
        {priceText === null ? null : <InfoRow label={t("price")} value={priceText} />}
        {delivery.note === null ? null : <InfoRow label={t("note")} value={delivery.note} />}
      </dl>
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const tStatus = useTranslations("books.deliveryStatus.labels");
  const base = deliveryStatuses.find((entry) => entry.value === status);
  if (base === undefined) return null;
  return <StatusBadge entry={{ ...base, label: tStatus(status) }} />;
}

function formatPrice(
  price: null | number,
  currency: Currency | null,
  locale: string,
): null | string {
  if (price === null) return null;
  const amount = new Intl.NumberFormat(locale).format(price);
  return currency === null ? amount : `${amount} ${currency}`;
}

function HistoryPreview({
  bookId,
  latest,
  totalCount,
}: {
  bookId: string;
  latest: DeliveryView;
  totalCount: number;
}) {
  const t = useTranslations("books.details.delivery");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const history = useDeliveryHistory(bookId, expanded);

  const previewDate = terminalDate(latest) ?? latest.orderDate;
  const previewLabel =
    latest.receivedAt !== null
      ? t("fields.receivedAt")
      : latest.cancelledAt !== null
        ? t("fields.cancelledAt")
        : t("fields.orderDate");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/40 p-3.5">
        <DeliveryStatusBadge status={latest.status} />
        <dl className="flex flex-col gap-2">
          {latest.storeName === null ? null : (
            <InfoRow label={t("fields.store")} value={latest.storeName} />
          )}
          {previewDate === null ? null : (
            <InfoRow label={previewLabel} value={formatDate(previewDate, locale)} />
          )}
        </dl>
      </div>

      <p className="text-sm text-muted-foreground">{t("history.count", { count: totalCount })}</p>

      <Button
        aria-expanded={expanded}
        className="w-full"
        onClick={() => setExpanded((value) => !value)}
        size="sm"
        variant="ghost"
      >
        {expanded ? t("history.hide") : t("history.show")}
      </Button>

      {expanded ? (
        history.isPending ? (
          <p className="text-sm text-muted-foreground">{t("history.loading")}</p>
        ) : history.isError || history.data === undefined ? (
          <p className="text-sm text-muted-foreground">{t("history.error")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.data.map((entry) => (
              <HistoryRow entry={entry} key={entry.id} locale={locale} />
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function HistoryRow({ entry, locale }: { entry: DeliveryView; locale: string }) {
  const terminal = terminalDate(entry);

  return (
    <li className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <DeliveryStatusBadge status={entry.status} />
      {entry.storeName === null ? null : (
        <span className="text-sm text-foreground/90">{entry.storeName}</span>
      )}
      {entry.orderDate === null ? null : (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(entry.orderDate, locale)}
          {terminal === null ? "" : ` → ${formatDate(terminal, locale)}`}
        </span>
      )}
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm break-words text-foreground/90">{value}</dd>
    </div>
  );
}

function RepairState({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("books.details.delivery");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{t("repair.text")}</p>
      <Button className="w-full" onClick={onAdd}>
        <UiIcon name="plus" size={16} />
        {t("repair.add")}
      </Button>
    </div>
  );
}

function terminalDate(delivery: DeliveryView): null | string {
  return delivery.receivedAt ?? delivery.cancelledAt;
}
