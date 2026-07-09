"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";

import type { DeliveryHistoryCardModel } from "../model/history-card-model";

type DeliveryHistoryCardProps = {
  model: DeliveryHistoryCardModel;
  onCancel: () => void;
  onEdit: () => void;
  onReceive: () => void;
  receivePending: boolean;
};

export function DeliveryHistoryCard({
  model,
  onCancel,
  onEdit,
  onReceive,
  receivePending,
}: DeliveryHistoryCardProps) {
  const t = useTranslations("delivery.card");
  const tHistory = useTranslations("delivery.history.card");
  const tCommon = useTranslations("common");
  const { book } = model;
  const title = book?.title ?? tHistory("deletedBook");

  return (
    <article className="relative flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex gap-3.5">
        <CardCover book={book} title={title} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <StatusBadge entry={model.badge} />
          {book === null ? (
            <p className="line-clamp-2 font-heading text-sm leading-tight font-bold text-muted-foreground">
              {title}
            </p>
          ) : (
            <Link
              className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink transition-colors hover:text-primary"
              href={book.href}
            >
              {title}
            </Link>
          )}
          {book === null ? (
            <p className="text-xs text-muted-foreground">{tHistory("deletedBookHint")}</p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{book.authorName}</p>
          )}
          {book?.seriesText ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UiIcon className="shrink-0" name="layers" size={13} />
              <span className="truncate">{book.seriesText}</span>
            </p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t("actionsAria", { title })} size="icon" variant="ghost">
              <UiIcon name="more" size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {book === null ? null : (
              <DropdownMenuItem asChild>
                <Link href={book.href}>
                  <UiIcon name="book" size={16} />
                  {t("openBook")}
                </Link>
              </DropdownMenuItem>
            )}
            {model.trackingHref === null ? null : (
              <DropdownMenuItem asChild>
                <a href={model.trackingHref} rel="noopener noreferrer" target="_blank">
                  <UiIcon name="external" size={16} />
                  {t("openTracking")}
                  <span className="sr-only">{tCommon("opensInNewTab")}</span>
                </a>
              </DropdownMenuItem>
            )}
            {model.isActive ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onEdit}>
                  <UiIcon name="edit" size={16} />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onReceive}>
                  <UiIcon name="check-circle" size={16} />
                  {t("receive")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onCancel} variant="destructive">
                  <UiIcon name="x-circle" size={16} />
                  {t("cancel")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <HistoryDetails model={model} />

      {model.isActive ? (
        <Button
          className="w-full"
          disabled={receivePending}
          loading={receivePending}
          onClick={onReceive}
        >
          <UiIcon name="check-circle" size={16} />
          {t("receive")}
        </Button>
      ) : null}
    </article>
  );
}

function CardCover({ book, title }: { book: DeliveryHistoryCardModel["book"]; title: string }) {
  const className =
    "relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft sm:w-20";

  const placeholder = (
    <span className="grid h-full w-full place-items-center text-accent-foreground/70">
      <UiIcon name="book" size={22} />
    </span>
  );

  if (book === null) {
    return <div className={className}>{placeholder}</div>;
  }

  return (
    <Link className={className} href={book.href}>
      {book.coverSrc === undefined ? (
        placeholder
      ) : (
        <Image
          alt={title}
          className="object-cover"
          fill
          sizes="80px"
          src={book.coverSrc}
          unoptimized
        />
      )}
    </Link>
  );
}

function HistoryDetails({ model }: { model: DeliveryHistoryCardModel }) {
  const t = useTranslations("delivery.card");
  const tHistory = useTranslations("delivery.history.card");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border border-border bg-secondary/40 p-3.5 sm:grid-cols-2">
        {model.storeName === null ? null : <InfoRow label={t("store")} value={model.storeName} />}
        {model.orderDateText === null ? null : (
          <InfoRow label={t("orderDate")} value={model.orderDateText} />
        )}
        {model.expectedDateText === null ? null : (
          <InfoRow label={t("expectedDate")} value={model.expectedDateText} />
        )}
        {model.receivedDateText === null ? null : (
          <InfoRow label={tHistory("receivedDate")} value={model.receivedDateText} />
        )}
        {model.cancelledDateText === null ? null : (
          <InfoRow label={tHistory("cancelledDate")} value={model.cancelledDateText} />
        )}
        {model.orderNumber === null ? null : (
          <InfoRow label={t("orderNumber")} value={model.orderNumber} />
        )}
        {model.deliveryService === null ? null : (
          <InfoRow label={t("service")} value={model.deliveryService} />
        )}
        {model.trackingNumber === null ? null : (
          <InfoRow label={t("trackingNumber")} value={model.trackingNumber} />
        )}
        {model.priceText === null ? null : <InfoRow label={t("price")} value={model.priceText} />}
        {model.trackingHref === null ? null : (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("tracking")}</dt>
            <dd>
              <a
                className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-sm text-primary underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                href={model.trackingHref}
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

      {model.cancelReason === null ? null : (
        <div className="flex flex-col gap-1 rounded-md border border-error/20 bg-error-soft/50 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-error">
            <UiIcon name="x-circle" size={13} />
            {tHistory("cancelReason")}
          </span>
          <p className="text-sm break-words text-foreground/90">{model.cancelReason}</p>
        </div>
      )}

      {model.note === null ? null : (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-secondary/40 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UiIcon name="note" size={13} />
            {tHistory("note")}
          </span>
          <p className="text-sm break-words text-foreground/90">{model.note}</p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm break-words text-foreground/90">{value}</dd>
    </div>
  );
}
