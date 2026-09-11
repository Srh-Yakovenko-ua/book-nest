"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { PostFinishQuotesBlock } from "./post-finish-quotes-block";
import { QuoteRediscoveryBlock } from "./quote-rediscovery-block";

const SIDEBAR_VISIBLE_QUERY = "(min-width: 40rem)";

type QuotesQuickActionsProps = {
  onAddQuote: () => void;
  onClearFilters: () => void;
  onShowFavorites: () => void;
  onShowRecent: () => void;
  onShowWithComment: () => void;
};

export function QuotesQuickActions({
  onAddQuote,
  onClearFilters,
  onShowFavorites,
  onShowRecent,
  onShowWithComment,
}: QuotesQuickActionsProps) {
  const t = useTranslations("quotes.sidebar");
  const tActions = useTranslations("quotes.actions");

  return (
    <>
      <SidebarBlock title={t("quickFilters.title")}>
        <div className="flex flex-col gap-2">
          <Button className="justify-start" onClick={onShowWithComment} variant="secondary">
            <UiIcon name="note" size={16} />
            {t("quickFilters.withComment")}
          </Button>
          <Button className="justify-start" onClick={onShowFavorites} variant="secondary">
            <UiIcon name="heart" size={16} />
            {t("quickFilters.favorites")}
          </Button>
          <Button className="justify-start" onClick={onShowRecent} variant="secondary">
            <UiIcon name="clock" size={16} />
            {t("quickFilters.recent")}
          </Button>
          <Button className="justify-start" onClick={onClearFilters} variant="ghost">
            <UiIcon name="x" size={16} />
            {t("quickFilters.clear")}
          </Button>
        </div>
      </SidebarBlock>

      <SidebarBlock title={t("cta.title")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("cta.description")}</p>
        <Button className="justify-start" onClick={onAddQuote}>
          <UiIcon name="plus" size={16} />
          {tActions("add")}
        </Button>
      </SidebarBlock>
    </>
  );
}

export function QuotesSidebar() {
  const t = useTranslations("quotes.sidebar");
  const isSidebarOnScreen = useIsSidebarOnScreen();

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      {isSidebarOnScreen ? (
        <>
          <QuoteRediscoveryBlock isVisible />

          <PostFinishQuotesBlock />
        </>
      ) : null}
    </aside>
  );
}

function readSidebarOnScreen(): boolean {
  return window.matchMedia(SIDEBAR_VISIBLE_QUERY).matches;
}

function readSidebarOnScreenOnServer(): boolean {
  return false;
}

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function subscribeToSidebarViewport(onChange: () => void) {
  const query = window.matchMedia(SIDEBAR_VISIBLE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsSidebarOnScreen(): boolean {
  return useSyncExternalStore(
    subscribeToSidebarViewport,
    readSidebarOnScreen,
    readSidebarOnScreenOnServer,
  );
}
