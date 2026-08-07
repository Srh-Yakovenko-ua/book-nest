"use client";

import type { QuotesSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

type QuotesQuickActionsProps = {
  onAddQuote: () => void;
  onClearFilters: () => void;
  onShowFavorites: () => void;
  onShowRecent: () => void;
  onShowWithComment: () => void;
};

type QuotesSidebarProps = QuotesQuickActionsProps & {
  isLoading: boolean;
  summary: QuotesSummaryView | undefined;
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

export function QuotesSidebar({ isLoading, summary, ...quickActions }: QuotesSidebarProps) {
  const t = useTranslations("quotes.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("stats.title")}>
        {isLoading || summary === undefined ? (
          <RowSkeleton rows={5} />
        ) : (
          <QuotesStats summary={summary} />
        )}
      </SidebarBlock>

      <QuotesQuickActions {...quickActions} />
    </aside>
  );
}

function QuotesStats({ summary }: { summary: QuotesSummaryView }) {
  const t = useTranslations("quotes.sidebar.stats");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2">
        <StatRow icon="quote" label={t("total")} value={formatNumber(summary.totalCount, locale)} />
        <StatRow
          icon="heart"
          label={t("favorites")}
          value={formatNumber(summary.favoritesCount, locale)}
        />
        <StatRow
          icon="eye-off"
          label={t("spoilers")}
          value={formatNumber(summary.spoilerCount, locale)}
        />
        <StatRow
          icon="eye"
          label={t("withoutSpoilers")}
          value={formatNumber(summary.withoutSpoilerCount, locale)}
        />
        <StatRow
          icon="note"
          label={t("withComment")}
          value={formatNumber(summary.withCommentCount, locale)}
        />
      </dl>

      {summary.topBook === null && summary.topAuthor === null ? null : (
        <dl className="flex flex-col gap-2 border-t border-border pt-3">
          {summary.topBook === null ? null : (
            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UiIcon className="text-icon" name="book" size={14} />
                {t("topBook")}
              </dt>
              <dd className="min-w-0">
                <Link
                  className="line-clamp-2 text-sm font-medium text-ink no-underline transition-colors hover:text-primary"
                  href={`/books/${summary.topBook.id}`}
                >
                  {summary.topBook.title}
                </Link>
              </dd>
            </div>
          )}
          {summary.topAuthor === null ? null : (
            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UiIcon className="text-icon" name="user" size={14} />
                {t("topAuthor")}
              </dt>
              <dd className="line-clamp-2 min-w-0 text-sm font-medium text-ink">
                {summary.topAuthor.name}
              </dd>
            </div>
          )}
        </dl>
      )}
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
