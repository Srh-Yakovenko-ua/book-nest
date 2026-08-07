"use client";

import type { Nullable, WishlistCurrencyEstimate, WishlistSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

import type { WishlistBestOffer } from "../model/books-to-buy-derive";

import { formatStorePrice } from "../model/format-store-price";

const BEST_OFFERS_LIMIT = 3;

type BooksToBuySidebarProps = {
  bestOffers: WishlistBestOffer[];
  isLoading: boolean;
  onShowBestOffers: () => void;
  summary: undefined | WishlistSummaryView;
};

export function BooksToBuySidebar({
  bestOffers,
  isLoading,
  onShowBestOffers,
  summary,
}: BooksToBuySidebarProps) {
  const t = useTranslations("booksToBuy.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("stats.title")}>
        {isLoading || summary === undefined ? (
          <RowSkeleton rows={4} />
        ) : (
          <WishlistStats summary={summary} />
        )}
      </SidebarBlock>

      <WishlistBestOffersBlock
        bestOffers={bestOffers}
        isLoading={isLoading}
        onShowBestOffers={onShowBestOffers}
      />

      <WishlistQuickActionsBlock />

      <WishlistHowItWorksBlock />
    </aside>
  );
}

export function WishlistBestOffersBlock({
  bestOffers,
  isLoading,
  onShowBestOffers,
}: Omit<BooksToBuySidebarProps, "summary">) {
  const t = useTranslations("booksToBuy.sidebar");

  return (
    <SidebarBlock title={t("bestOffers.title")}>
      {isLoading ? (
        <RowSkeleton rows={3} />
      ) : bestOffers.length === 0 ? (
        <EmptyText>{t("bestOffers.empty")}</EmptyText>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {bestOffers.slice(0, BEST_OFFERS_LIMIT).map((offer) => (
              <BestOfferRow key={offer.bookId} offer={offer} />
            ))}
          </ul>
          <Button className="self-start" onClick={onShowBestOffers} size="sm" variant="secondary">
            {t("bestOffers.showAll")}
            <UiIcon name="arrow-right" size={14} />
          </Button>
        </>
      )}
    </SidebarBlock>
  );
}

export function WishlistHowItWorksBlock() {
  const t = useTranslations("booksToBuy.sidebar");

  return (
    <SidebarBlock title={t("howItWorks.title")}>
      <div className="flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-muted-foreground">{t("howItWorks.bought")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("howItWorks.delivery")}</p>
      </div>
    </SidebarBlock>
  );
}

export function WishlistQuickActionsBlock() {
  const t = useTranslations("booksToBuy.sidebar");

  return (
    <SidebarBlock title={t("quickActions.title")}>
      <div className="flex flex-col gap-2">
        <Button asChild className="justify-start" variant="secondary">
          <MobilePageOverviewLink href="/books/new">
            <UiIcon name="plus" size={16} />
            {t("quickActions.addBook")}
          </MobilePageOverviewLink>
        </Button>
        <Button asChild className="justify-start" variant="secondary">
          <MobilePageOverviewLink href="/books">
            <UiIcon name="library" size={16} />
            {t("quickActions.openLibrary")}
          </MobilePageOverviewLink>
        </Button>
        <Button asChild className="justify-start" variant="ghost">
          <MobilePageOverviewLink href="/delivery/in-transit">
            <UiIcon name="truck" size={16} />
            {t("quickActions.inTransit")}
          </MobilePageOverviewLink>
        </Button>
      </div>
    </SidebarBlock>
  );
}

function BestOfferCover({ alt, src }: { alt: string; src: Nullable<string> }) {
  if (src === null) {
    return (
      <div className="grid aspect-[3/4] w-8 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={14} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="32px" src={src} unoptimized />
    </div>
  );
}

function BestOfferRow({ offer }: { offer: WishlistBestOffer }) {
  const locale = useLocale();

  return (
    <li>
      <MobilePageOverviewLink
        className="group/offer flex items-center gap-2.5 rounded-md px-2 py-1.5 no-underline transition-colors hover:bg-secondary motion-reduce:transition-none"
        href={`/books/${offer.bookId}`}
      >
        <BestOfferCover alt={offer.title} src={offer.coverUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-ink transition-colors group-hover/offer:text-primary">
            {offer.title}
          </span>
          {offer.storeName === null ? null : (
            <span className="truncate text-xs text-muted-foreground">{offer.storeName}</span>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-success tabular-nums">
          {formatStorePrice({ currency: offer.currency, locale, price: offer.price })}
        </span>
      </MobilePageOverviewLink>
    </li>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function EstimateGroup({
  caption,
  estimate,
}: {
  caption: Nullable<string>;
  estimate: WishlistCurrencyEstimate;
}) {
  const t = useTranslations("booksToBuy.sidebar");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-2">
      {caption === null ? null : (
        <p className="text-xs font-medium text-muted-foreground tabular-nums">{caption}</p>
      )}
      <dl className="flex flex-col gap-2">
        <StatRow
          icon="chart"
          label={t("stats.average")}
          value={formatStorePrice({
            currency: estimate.currency,
            locale,
            price: Math.round(estimate.average),
          })}
        />
        <StatRow
          icon="tag"
          label={t("stats.best")}
          value={formatStorePrice({ currency: estimate.currency, locale, price: estimate.best })}
        />
      </dl>
    </div>
  );
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center justify-between gap-2" key={index}>
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function StatRow({ icon, label, value }: { icon: UiIconName; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <UiIcon className="text-icon" name={icon} size={14} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="shrink-0 text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function WishlistStats({ summary }: { summary: WishlistSummaryView }) {
  const t = useTranslations("booksToBuy.sidebar");
  const locale = useLocale();
  const showCurrencyCaptions =
    summary.estimates.length > 1 ||
    summary.estimates.some((estimate) => estimate.booksCount < summary.booksCount);

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2">
        <StatRow
          icon="book"
          label={t("stats.booksCount")}
          value={formatNumber(summary.booksCount, locale)}
        />
        <StatRow
          icon="store"
          label={t("stats.storesCount")}
          value={formatNumber(summary.trackedStoresCount, locale)}
        />
      </dl>
      {summary.estimates.length === 0 ? (
        <EmptyText>{t("stats.pricesEmpty")}</EmptyText>
      ) : (
        summary.estimates.map((estimate) => (
          <EstimateGroup
            caption={
              showCurrencyCaptions
                ? t("stats.currencyGroup", {
                    count: estimate.booksCount,
                    currency: estimate.currency,
                  })
                : null
            }
            estimate={estimate}
            key={estimate.currency}
          />
        ))
      )}
    </div>
  );
}
