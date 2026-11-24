"use client";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { HomeLibraryCountKey, HomeSummaryState } from "../model/home-summary";

import { HOME_LIBRARY_LINKS } from "../model/home-library-links";
import { HOME_LIBRARY_COUNT_KEYS } from "../model/home-summary";

type HomeLibrarySummaryStripProps = {
  isRetrying: boolean;
  onRetry: () => void;
  state: HomeSummaryState;
};

const SUMMARY_ICONS = {
  favorites: "heart",
  finished: "check-circle",
  reading: "book-open-text",
  total: "library",
} as const satisfies Record<HomeLibraryCountKey, UiIconName>;

const SUMMARY_STYLES = {
  cell: "flex min-h-12 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-card @2xl/home:border-0 @2xl/home:bg-transparent @2xl/home:shadow-none",
  link: "cursor-pointer outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors",
  list: "grid min-w-0 flex-1 grid-cols-2 gap-2 @2xl/home:grid-cols-4 @2xl/home:gap-1",
  strip:
    "flex min-w-0 flex-col gap-2 @2xl/home:flex-row @2xl/home:items-center @2xl/home:rounded-xl @2xl/home:border @2xl/home:border-border @2xl/home:bg-card @2xl/home:p-1.5 @2xl/home:shadow-card",
} as const;

export function HomeLibrarySummaryStrip({
  isRetrying,
  onRetry,
  state,
}: HomeLibrarySummaryStripProps) {
  const t = useTranslations("home.summary");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  if (state.kind === "loading") {
    return (
      <div aria-busy className={SUMMARY_STYLES.strip}>
        <span className="sr-only" role="status">
          {tCommon("loading")}
        </span>
        <ul aria-label={t("label")} className={SUMMARY_STYLES.list}>
          {HOME_LIBRARY_COUNT_KEYS.map((key) => (
            <li className={SUMMARY_STYLES.cell} key={key}>
              <UiIcon aria-hidden className="shrink-0 text-primary" name={SUMMARY_ICONS[key]} />
              <Skeleton className="h-6 w-20" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const counts = state.kind === "ready" ? state.counts : null;
  const showsRetry = state.kind === "error" || state.isStale;

  return (
    <div className={SUMMARY_STYLES.strip}>
      <ul aria-label={t("label")} className={SUMMARY_STYLES.list}>
        {HOME_LIBRARY_COUNT_KEYS.map((key) => {
          const count = counts === null ? null : counts[key];

          return (
            <li className="min-w-0" key={key}>
              <Link
                className={cn(SUMMARY_STYLES.cell, SUMMARY_STYLES.link)}
                href={HOME_LIBRARY_LINKS.counts[key]}
              >
                <UiIcon aria-hidden className="shrink-0 text-primary" name={SUMMARY_ICONS[key]} />
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                  {count === null ? (
                    <>
                      <span aria-hidden className="font-heading text-xl font-semibold text-ink">
                        —
                      </span>
                      <span className="sr-only">{t("unavailable")}</span>
                    </>
                  ) : (
                    <span className="font-heading text-xl font-semibold wrap-anywhere text-ink tabular-nums">
                      {formatNumber(count, locale)}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {t(`counts.${key}`, { count: count ?? 0 })}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {showsRetry ? (
        <div className="flex items-center gap-2 px-1 @2xl/home:px-0">
          <span className="text-xs text-muted-foreground @2xl/home:sr-only" role="status">
            {t("error")}
          </span>
          <Button
            aria-label={t("retry")}
            loading={isRetrying}
            onClick={onRetry}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon aria-hidden name="refresh" size={16} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
