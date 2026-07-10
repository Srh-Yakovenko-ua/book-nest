"use client";

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

import type { DeliveryCardModel } from "../model/delivery-card-model";

type DeliveryCardProps = {
  model: DeliveryCardModel;
  onCancel: () => void;
  onEdit: () => void;
  onReceive: () => void;
  onToggleSelect: () => void;
  receivePending: boolean;
  selected: boolean;
};

export function DeliveryCard({
  model,
  onCancel,
  onEdit,
  onReceive,
  onToggleSelect,
  receivePending,
  selected,
}: DeliveryCardProps) {
  const t = useTranslations("delivery.card");
  const tCommon = useTranslations("common");

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200",
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
      )}
    >
      <div className="flex gap-3.5">
        <span className="mt-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md">
          <Checkbox
            aria-label={t("selectAria", { title: model.title })}
            checked={selected}
            onCheckedChange={onToggleSelect}
          />
        </span>

        <Link
          className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft sm:w-20"
          href={model.bookHref}
        >
          {model.coverSrc === undefined ? (
            <span className="grid h-full w-full place-items-center text-accent-foreground/70">
              <UiIcon name="book" size={22} />
            </span>
          ) : (
            <Image
              alt={model.title}
              className="object-cover"
              fill
              sizes="80px"
              src={model.coverSrc}
              unoptimized
            />
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <StatusBadge entry={model.badge} />
          <Link
            className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink transition-colors hover:text-primary"
            href={model.bookHref}
          >
            {model.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{model.authorName}</p>
          {model.seriesText === null ? null : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UiIcon className="shrink-0" name="layers" size={13} />
              <span className="truncate">{model.seriesText}</span>
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("actionsAria", { title: model.title })}
              size="icon"
              variant="ghost"
            >
              <UiIcon name="more" size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onEdit}>
              <UiIcon name="edit" size={16} />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={model.bookHref}>
                <UiIcon name="book" size={16} />
                {t("openBook")}
              </Link>
            </DropdownMenuItem>
            {model.trackingHref === null ? null : (
              <DropdownMenuItem asChild>
                <a href={model.trackingHref} rel="noopener noreferrer" target="_blank">
                  <UiIcon name="external" size={16} />
                  {t("openTracking")}
                  <span className="sr-only">{tCommon("opensInNewTab")}</span>
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCancel} variant="destructive">
              <UiIcon name="x-circle" size={16} />
              {t("cancel")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeliveryDetails model={model} />

      <Button
        className="w-full"
        disabled={receivePending}
        loading={receivePending}
        onClick={onReceive}
      >
        <UiIcon name="check-circle" size={16} />
        {t("receive")}
      </Button>
    </article>
  );
}

function DeliveryDetails({ model }: { model: DeliveryCardModel }) {
  const t = useTranslations("delivery.card");
  const tCommon = useTranslations("common");

  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border border-border bg-secondary/40 p-3.5 sm:grid-cols-2">
      {model.storeName === null ? null : <InfoRow label={t("store")} value={model.storeName} />}
      {model.orderDateText === null ? null : (
        <InfoRow label={t("orderDate")} value={model.orderDateText} />
      )}
      {model.expectedDateText === null ? null : (
        <InfoRow label={t("expectedDate")} value={model.expectedDateText} />
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
