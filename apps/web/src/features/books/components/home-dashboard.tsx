"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/features/auth";
import { Link } from "@/i18n/navigation";

import { useLibraryOverview } from "../api/use-library-overview";
import { DeliveryDashboardWidget } from "./delivery-dashboard-widget";
import { type LibrarySummaryCard, LibrarySummaryCards } from "./library-summary-cards";

export function HomeDashboard() {
  const t = useTranslations("home");
  const tSummary = useTranslations("books.library");
  const overview = useLibraryOverview();
  const user = useAuthStore((state) => state.user);

  const displayName = user?.nickname ?? user?.name ?? null;
  const summary = overview.data?.summary;
  const isEmpty = summary !== undefined && summary.total === 0;

  const summaryCards: LibrarySummaryCard[] = [
    { icon: "library", label: tSummary("summary.total"), value: summary?.total ?? 0 },
    { icon: "book", label: tSummary("summary.reading"), value: summary?.reading ?? 0 },
    { icon: "check-circle", label: tSummary("summary.finished"), value: summary?.finished ?? 0 },
    { icon: "heart", label: tSummary("summary.favorites"), value: summary?.favorites ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-tight font-normal text-ink">
          {displayName ? t("greeting", { name: displayName }) : t("greetingFallback")}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("subtitle")}
        </p>
      </header>

      {isEmpty ? (
        <EmptyState
          action={t("empty.action")}
          description={t("empty.description")}
          title={t("empty.title")}
        />
      ) : (
        <>
          <LibrarySummaryCards cards={summaryCards} isLoading={overview.isPending} />

          <DeliveryDashboardWidget />

          <ReadingProgress
            finished={summary?.finished ?? 0}
            isLoading={overview.isPending}
            label={t("progress.label", {
              finished: summary?.finished ?? 0,
              total: summary?.total ?? 0,
            })}
            title={t("progress.title")}
            total={summary?.total ?? 0}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/books/new">
                <UiIcon name="plus" size={18} />
                {t("actions.addBook")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/books">{t("actions.library")}</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({
  action,
  description,
  title,
}: {
  action: string;
  description: string;
  title: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 border border-dashed border-border bg-card px-6 py-12 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-full bg-accent text-primary">
        <UiIcon name="library" size={28} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-xl font-medium text-ink">{title}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href="/books/new">
          <UiIcon name="plus" size={18} />
          {action}
        </Link>
      </Button>
    </Card>
  );
}

function ReadingProgress({
  finished,
  isLoading,
  label,
  title,
  total,
}: {
  finished: number;
  isLoading: boolean;
  label: string;
  title: string;
  total: number;
}) {
  const percent = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <Card className="flex flex-col gap-3 border border-border bg-card p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {isLoading ? "—" : label}
        </span>
      </div>
      <div
        aria-hidden
        className="h-2.5 overflow-hidden rounded-full bg-primary/10"
        data-slot="reading-progress-track"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${isLoading ? 0 : percent}%` }}
        />
      </div>
    </Card>
  );
}
