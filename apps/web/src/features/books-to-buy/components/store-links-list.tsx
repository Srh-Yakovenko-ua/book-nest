"use client";

import type { BestOfferView, BookStoreLinkView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { isHttpsUrl } from "@/lib/is-https-url";
import { cn } from "@/lib/utils";

import type { StoreLinkBook } from "./store-link-dialog";

import { findBestOfferLinkId } from "../model/best-offer-link";
import { formatStorePrice } from "../model/format-store-price";
import { StoreLinkMenu } from "./store-link-menu";

const VISIBLE_LINKS_LIMIT = 3;

export function StoreLinksList({
  bestOffer,
  book,
  className,
  storeLinks,
}: {
  bestOffer: Nullable<BestOfferView>;
  book: StoreLinkBook;
  className?: string;
  storeLinks: BookStoreLinkView[];
}) {
  const t = useTranslations("booksToBuy");
  const listId = useId();
  const [isExpanded, setIsExpanded] = useState(false);

  if (storeLinks.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>{t("storeLinks.empty")}</p>
    );
  }

  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });
  const visibleLinks = isExpanded ? storeLinks : storeLinks.slice(0, VISIBLE_LINKS_LIMIT);
  const hiddenCount = storeLinks.length - VISIBLE_LINKS_LIMIT;

  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-1", className)}>
      <ul aria-label={t("storeLinks.listLabel")} className="flex w-full flex-col gap-1" id={listId}>
        {visibleLinks.map((link) => (
          <li className="flex min-w-0 items-center gap-1" key={link.id}>
            <StoreLinkItem isBestOffer={link.id === bestOfferLinkId} link={link} />
            <StoreLinkMenu book={book} link={link} />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          aria-controls={listId}
          aria-expanded={isExpanded}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          type="button"
        >
          <UiIcon name={isExpanded ? "chevron-up" : "chevron-down"} size={12} />
          {isExpanded ? t("storeLinks.collapse") : t("storeLinks.expand", { count: hiddenCount })}
        </button>
      ) : null}
    </div>
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
