"use client";

import type { BestOfferView, BookStoreLinkView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { isHttpsUrl } from "@/lib/is-https-url";
import { cn } from "@/lib/utils";

import { findBestOfferLinkId } from "../model/best-offer-link";
import { formatStorePrice } from "../model/format-store-price";
import { hasMultipleCurrencies } from "../model/store-link-prices";

export function StoreLinksSummary({
  bestOffer,
  className,
  onManage,
  storeLinks,
}: {
  bestOffer: Nullable<BestOfferView>;
  className?: string;
  onManage: () => void;
  storeLinks: BookStoreLinkView[];
}) {
  const t = useTranslations("booksToBuy.storeLinks");

  if (storeLinks.length === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{t("empty")}</p>;
  }

  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });
  const offeredLink = storeLinks.find((link) => link.id === bestOfferLinkId);

  if (offeredLink === undefined) {
    return (
      <div className={cn("flex min-w-0 flex-col items-start", className)}>
        <ManageButton
          label={t("storeCount", { count: storeLinks.length })}
          note={t("noPricesNote")}
          onClick={onManage}
        />
      </div>
    );
  }

  const otherCount = storeLinks.length - 1;

  return (
    <div className={cn("flex min-w-0 flex-col items-stretch gap-1.5", className)}>
      {otherCount > 0 ? (
        <p className="text-[0.6875rem] font-medium text-muted-foreground">{t("bestOffer")}</p>
      ) : null}
      <OfferedLinkChip link={offeredLink} />
      {otherCount > 0 ? (
        <ManageButton
          label={t("more", { count: otherCount })}
          note={hasMultipleCurrencies(storeLinks) ? t("mixedCurrencyNote") : undefined}
          onClick={onManage}
        />
      ) : null}
    </div>
  );
}

function ManageButton({
  label,
  note,
  onClick,
}: {
  label: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-w-0 cursor-pointer items-start gap-1 rounded-md px-1.5 py-0.5 text-left text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none sm:items-center"
      onClick={onClick}
      type="button"
    >
      <UiIcon className="mt-0.5 shrink-0 sm:mt-0" name="store" size={12} />
      <span className="flex min-w-0 flex-col items-start sm:flex-row sm:items-center">
        <span className="min-w-0">{label}</span>
        {note === undefined ? null : (
          <span className="min-w-0 max-sm:text-muted-foreground">
            <span aria-hidden className="max-sm:hidden">
              {" · "}
            </span>
            {note}
          </span>
        )}
      </span>
    </button>
  );
}

function OfferedLinkChip({ link }: { link: BookStoreLinkView }) {
  const tCommon = useTranslations("common");
  const chipClassName =
    "flex w-full min-w-0 items-start gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-xs text-foreground sm:items-center";

  if (!isHttpsUrl(link.url)) {
    return (
      <div className={chipClassName}>
        <OfferedLinkChipContent link={link} />
      </div>
    );
  }

  return (
    <a
      className={cn(
        chipClassName,
        "group transition-colors outline-none hover:border-primary/30 hover:bg-secondary/70 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
      )}
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <OfferedLinkChipContent link={link} />
      <UiIcon
        className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary sm:mt-0"
        name="external"
        size={12}
      />
      <span className="sr-only">{tCommon("opensInNewTab")}</span>
    </a>
  );
}

function OfferedLinkChipContent({ link }: { link: BookStoreLinkView }) {
  const locale = useLocale();
  const priceText =
    link.price === null
      ? null
      : formatStorePrice({ currency: link.currency, locale, price: link.price });

  return (
    <>
      <UiIcon className="mt-0.5 shrink-0 text-icon sm:mt-0" name="store" size={12} />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1.5">
        <span className="w-full truncate sm:w-auto sm:min-w-0">{link.storeName}</span>
        {priceText === null ? null : (
          <span className="shrink-0 font-semibold text-ink tabular-nums">{priceText}</span>
        )}
      </span>
    </>
  );
}
