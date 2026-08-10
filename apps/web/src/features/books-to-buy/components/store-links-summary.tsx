"use client";

import type { BestOfferView, BookStoreLinkView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

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
        <ManageButton onClick={onManage}>
          {t("noPrices", { count: storeLinks.length })}
        </ManageButton>
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
        <ManageButton onClick={onManage}>
          {hasMultipleCurrencies(storeLinks)
            ? t("moreMixedCurrency", { count: otherCount })
            : t("more", { count: otherCount })}
        </ManageButton>
      ) : null}
    </div>
  );
}

function ManageButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
      onClick={onClick}
      type="button"
    >
      <UiIcon name="store" size={12} />
      {children}
    </button>
  );
}

function OfferedLinkChip({ link }: { link: BookStoreLinkView }) {
  const tCommon = useTranslations("common");
  const chipClassName =
    "flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-xs text-foreground";

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
        className="text-muted-foreground transition-colors group-hover:text-primary"
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
      <UiIcon className="text-icon" name="store" size={12} />
      <span className="min-w-0 flex-1 truncate">{link.storeName}</span>
      {priceText === null ? null : (
        <span className="font-semibold text-ink tabular-nums">{priceText}</span>
      )}
    </>
  );
}
