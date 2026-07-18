"use client";

import type { DedicationFilter, DedicationsSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenres } from "@/features/books/api/use-genres";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import { DEDICATION_QUICK_FILTERS } from "../model/dedications-query";

const QUICK_FILTER_ICONS = {
  favorites: "heart-fill",
  finished: "check-circle",
  unfinished: "clock",
  without_favorites: "heart",
} as const satisfies Record<(typeof DEDICATION_QUICK_FILTERS)[number], UiIconName>;

export type DedicationsSummaryState =
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "ready"; summary: DedicationsSummaryView };

type DedicationsSidebarProps = {
  filter: DedicationFilter;
  onQuickFilter: (value: DedicationFilter) => void;
  onRetrySummary: () => void;
  summaryState: DedicationsSummaryState;
};

export function DedicationsSidebar({
  filter,
  onQuickFilter,
  onRetrySummary,
  summaryState,
}: DedicationsSidebarProps) {
  const t = useTranslations("dedications.sidebar");
  const tFilter = useTranslations("dedications.sidebar.quickFilters");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("stats.title")}>
        <StatsSlot onRetry={onRetrySummary} state={summaryState} />
      </SidebarBlock>

      <SidebarBlock title={t("quickFilters.title")}>
        <div className="flex flex-col gap-2">
          {DEDICATION_QUICK_FILTERS.map((option) => (
            <Button
              aria-pressed={filter === option}
              className="justify-start"
              key={option}
              onClick={() => onQuickFilter(option)}
              variant={filter === option ? "default" : "secondary"}
            >
              <UiIcon name={QUICK_FILTER_ICONS[option]} size={16} />
              {tFilter(option)}
            </Button>
          ))}
        </div>
      </SidebarBlock>

      <section className="relative overflow-hidden rounded-xl border border-accent-border/60 bg-secondary p-4 shadow-card">
        <UiIcon
          className="absolute -top-1 right-2 text-accent-foreground/25"
          name="quote"
          size={48}
        />
        <p className="relative font-heading text-sm leading-relaxed text-ink italic">
          {t("quote.text")}
        </p>
      </section>

      <SidebarBlock title={t("helper.title")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("helper.text")}</p>
        <div className="flex flex-col gap-2">
          <Button asChild className="justify-start" variant="secondary">
            <Link href="/books/new">
              <UiIcon name="plus" size={16} />
              {t("helper.cta")}
            </Link>
          </Button>
          <Button asChild className="justify-start" variant="ghost">
            <Link href="/books">
              <UiIcon name="library" size={16} />
              {t("helper.secondary")}
            </Link>
          </Button>
        </div>
      </SidebarBlock>
    </aside>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled dedications summary state: ${String(value)}`);
}

function DedicationStats({ summary }: { summary: DedicationsSummaryView }) {
  const t = useTranslations("dedications.sidebar.stats");
  const locale = useLocale();
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const topGenre = summary.topGenre;
  const topAuthor = summary.topAuthor;

  return (
    <dl className="flex flex-col gap-2">
      <StatRow icon="quote" label={t("total")} value={formatNumber(summary.totalCount, locale)} />
      <StatRow
        icon="heart-fill"
        label={t("favorites")}
        value={formatNumber(summary.favoriteCount, locale)}
      />
      <StatRow
        icon="check-circle"
        label={t("fromFinished")}
        value={formatNumber(summary.finishedCount, locale)}
      />
      <StatRow
        icon="clock"
        label={t("fromUnfinished")}
        value={formatNumber(summary.unfinishedCount, locale)}
      />
      <StatRow
        icon="tag"
        label={t("topGenre")}
        value={
          topGenre === null ? t("empty") : (genreNameByKey.get(topGenre.genre) ?? topGenre.genre)
        }
      />
      <StatRow
        icon="user"
        label={t("topAuthor")}
        value={topAuthor === null ? t("empty") : topAuthor.name}
      />
    </dl>
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
      <dd className="max-w-[45%] truncate text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function StatsError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("dedications");

  return (
    <div className="flex flex-col items-start gap-2.5" role="alert">
      <p className="text-xs leading-relaxed text-muted-foreground">{t("sidebar.stats.error")}</p>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={14} />
        {t("error.retry")}
      </Button>
    </div>
  );
}

function StatsSlot({ onRetry, state }: { onRetry: () => void; state: DedicationsSummaryState }) {
  switch (state.kind) {
    case "error":
      return <StatsError onRetry={onRetry} />;
    case "loading":
      return <RowSkeleton rows={6} />;
    case "ready":
      return <DedicationStats summary={state.summary} />;
    default:
      return assertNever(state);
  }
}
