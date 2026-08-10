"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { AttentionBlock } from "@/components/attention-block";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryBooks } from "@/features/books/api/use-books";
import { UnsetOwnershipDialog } from "@/features/books/components/unset-ownership-dialog";
import { unsetOwnershipParams } from "@/features/books/model/unset-ownership";

import type { WishlistBestOffer } from "../model/books-to-buy-derive";

import { formatStorePrice } from "../model/format-store-price";

const BEST_OFFERS_LIMIT = 3;
const UNSET_OWNERSHIP_ITEM_ID = "unset_ownership";

type BooksToBuySidebarProps = {
  bestOffers: WishlistBestOffer[];
  isLoading: boolean;
  onShowBestOffers: () => void;
};

export function BooksToBuySidebar({
  bestOffers,
  isLoading,
  onShowBestOffers,
}: BooksToBuySidebarProps) {
  const t = useTranslations("booksToBuy.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <WishlistUnsetOwnershipBlock />

      <WishlistBestOffersBlock
        bestOffers={bestOffers}
        isLoading={isLoading}
        onShowBestOffers={onShowBestOffers}
      />
    </aside>
  );
}

export function WishlistBestOffersBlock({
  bestOffers,
  isLoading,
  onShowBestOffers,
}: BooksToBuySidebarProps) {
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

export function WishlistUnsetOwnershipBlock() {
  const t = useTranslations("booksToBuy.sidebar.attention");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const unsetOwnership = useLibraryBooks(unsetOwnershipParams(""));
  const count = unsetOwnership.data?.pages[0]?.totalCount ?? 0;

  return (
    <>
      <AttentionBlock
        activeId={isDialogOpen ? UNSET_OWNERSHIP_ITEM_ID : null}
        allClearLabel={t("allClear")}
        isLoading={unsetOwnership.isPending}
        items={
          count === 0
            ? []
            : [
                {
                  caption: t("unsetOwnership.caption"),
                  detail: t("unsetOwnership.detail", { count }),
                  icon: "circle-slash",
                  id: UNSET_OWNERSHIP_ITEM_ID,
                  label: t("unsetOwnership.title"),
                  toneClass: "text-warning",
                },
              ]
        }
        onSelect={() => setDialogOpen(true)}
        title={t("title")}
      />
      <UnsetOwnershipDialog onOpenChange={setDialogOpen} open={isDialogOpen} />
    </>
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
