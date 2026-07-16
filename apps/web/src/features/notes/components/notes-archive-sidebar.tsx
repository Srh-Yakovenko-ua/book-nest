"use client";

import type { NotesSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

import type { NotesArchiveQueryState, NotesSidebarFilter } from "../model/notes-archive-query";

import { NOTES_SIDEBAR_FILTERS } from "../model/notes-archive-query";

const SIDEBAR_FILTER_ICONS = {
  favorite: "heart-fill",
  for_review: "edit",
  no_spoiler: "eye",
  pinned: "bookmark",
  question: "help-circle",
  with_spoiler: "eye-off",
} as const satisfies Record<(typeof NOTES_SIDEBAR_FILTERS)[number]["value"], UiIconName>;

type NotesArchiveSidebarProps = {
  isLoading: boolean;
  onAddNote: () => void;
  onQuickFilter: (filter: NotesSidebarFilter) => void;
  state: NotesArchiveQueryState;
  summary: NotesSummaryView | undefined;
};

export function NotesArchiveSidebar({
  isLoading,
  onAddNote,
  onQuickFilter,
  state,
  summary,
}: NotesArchiveSidebarProps) {
  const t = useTranslations("notes.archive.sidebar");
  const tQuickFilter = useTranslations("notes.archive.sidebar.quickFilters");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("stats.title")}>
        {isLoading || summary === undefined ? (
          <RowSkeleton rows={9} />
        ) : (
          <NotesStats summary={summary} />
        )}
      </SidebarBlock>

      <SidebarBlock title={t("quickFilters.title")}>
        <div className="flex flex-col gap-2">
          {NOTES_SIDEBAR_FILTERS.map((option) => {
            const isActive = isSidebarFilterActive(option, state);
            return (
              <Button
                aria-pressed={isActive}
                className="justify-start"
                key={option.value}
                onClick={() => onQuickFilter(option)}
                variant={isActive ? "default" : "secondary"}
              >
                <UiIcon name={SIDEBAR_FILTER_ICONS[option.value]} size={16} />
                {tQuickFilter(option.value)}
              </Button>
            );
          })}
        </div>
      </SidebarBlock>

      <section className="relative overflow-hidden rounded-xl border border-accent-border/60 bg-secondary p-4 shadow-card">
        <UiIcon
          className="absolute -top-1 right-2 text-accent-foreground/25"
          name="bulb"
          size={48}
        />
        <h2 className="relative font-heading text-sm font-semibold text-ink">{t("tip.title")}</h2>
        <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">
          {t("tip.text")}
        </p>
      </section>

      <SidebarBlock title={t("quickAction.title")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("quickAction.text")}</p>
        <Button className="justify-start" onClick={onAddNote} variant="secondary">
          <UiIcon name="plus" size={16} />
          {t("quickAction.cta")}
        </Button>
      </SidebarBlock>
    </aside>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled notes sidebar filter: ${String(value)}`);
}

function isSidebarFilterActive(option: NotesSidebarFilter, state: NotesArchiveQueryState): boolean {
  switch (option.kind) {
    case "category":
      return state.category === option.value;
    case "filter":
      return state.filter === option.value;
    default:
      return assertNever(option);
  }
}

function NotesStats({ summary }: { summary: NotesSummaryView }) {
  const t = useTranslations("notes.archive.sidebar.stats");
  const locale = useLocale();

  return (
    <dl className="flex flex-col gap-2">
      <StatRow icon="note" label={t("total")} value={formatNumber(summary.total, locale)} />
      <StatRow
        icon="book"
        label={t("bookNotes")}
        value={formatNumber(summary.bookNotesCount, locale)}
      />
      <StatRow
        icon="layers"
        label={t("seriesNotes")}
        value={formatNumber(summary.seriesNotesCount, locale)}
      />
      <StatRow
        icon="eye"
        label={t("withoutSpoiler")}
        value={formatNumber(summary.withoutSpoilerCount, locale)}
      />
      <StatRow
        icon="eye-off"
        label={t("withSpoiler")}
        value={formatNumber(summary.withSpoilerCount, locale)}
      />
      <StatRow
        icon="heart-fill"
        label={t("favorite")}
        value={formatNumber(summary.favoriteCount, locale)}
      />
      <StatRow
        icon="bookmark"
        label={t("pinned")}
        value={formatNumber(summary.pinnedCount, locale)}
      />
      <StatRow
        icon="library"
        label={t("booksWithNotes")}
        value={formatNumber(summary.booksWithNotesCount, locale)}
      />
      <StatRow
        icon="list"
        label={t("seriesWithNotes")}
        value={formatNumber(summary.seriesWithNotesCount, locale)}
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
      <dd className="shrink-0 text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
