"use client";

import type { BestOfferView, BookStoreLinkView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { isHttpsUrl } from "@/lib/is-https-url";
import { cn } from "@/lib/utils";

import { findBestOfferLinkId } from "../model/best-offer-link";
import { formatStorePrice } from "../model/format-store-price";

export function StoreLinksList({
  bestOffer,
  label,
  storeLinks,
}: {
  bestOffer: Nullable<BestOfferView>;
  label: string;
  storeLinks: BookStoreLinkView[];
}) {
  const t = useTranslations("booksToBuy");

  if (storeLinks.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("storeLinks.empty")}</p>;
  }

  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });

  return (
    <ul aria-label={label} className="flex w-full flex-col gap-1">
      {storeLinks.map((link) => (
        <li className="flex min-w-0 items-center" key={link.id}>
          <StoreLinkItem isBestOffer={link.id === bestOfferLinkId} link={link} />
        </li>
      ))}
    </ul>
  );
}

function StoreLinkContent({
  isBestOffer,
  link,
}: {
  isBestOffer: boolean;
  link: BookStoreLinkView;
}) {
  const t = useTranslations("booksToBuy");
  const locale = useLocale();
  const priceText =
    link.price === null
      ? null
      : formatStorePrice({ currency: link.currency, locale, price: link.price });

  return (
    <>
      <UiIcon className="text-muted-foreground" name="store" size={12} />
      <span className="min-w-0 flex-1 truncate">{link.storeName}</span>
      {priceText === null ? null : (
        <span
          className={cn(
            "flex items-center gap-1 tabular-nums",
            isBestOffer ? "font-semibold text-success" : "text-muted-foreground",
          )}
        >
          {isBestOffer ? <UiIcon name="tag" size={12} /> : null}
          {priceText}
          {isBestOffer ? <span className="sr-only">{t("storeLinks.bestOffer")}</span> : null}
        </span>
      )}
    </>
  );
}

function StoreLinkItem({ isBestOffer, link }: { isBestOffer: boolean; link: BookStoreLinkView }) {
  const tCommon = useTranslations("common");
  const itemClassName = cn(
    "flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
    isBestOffer ? "border-success/30 bg-success-soft/50" : "border-border bg-muted/40",
  );

  if (!isHttpsUrl(link.url)) {
    return (
      <div className={itemClassName}>
        <StoreLinkContent isBestOffer={isBestOffer} link={link} />
      </div>
    );
  }

  return (
    <a
      className={cn(
        itemClassName,
        "transition-colors outline-none hover:border-accent-border hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
      )}
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <StoreLinkContent isBestOffer={isBestOffer} link={link} />
      <UiIcon className="text-muted-foreground" name="external" size={12} />
      <span className="sr-only">{tCommon("opensInNewTab")}</span>
    </a>
  );
}
