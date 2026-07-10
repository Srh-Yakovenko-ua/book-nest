"use client";

import type { ChangelogCategory, ChangelogEntryView, ChangelogLocale } from "@app/shared";

import { useTranslations } from "next-intl";
import { GroupedVirtuoso } from "react-virtuoso";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateLong } from "@/lib/format";

export type ChangelogPopoverState =
  | {
      entries: ChangelogEntryView[];
      hasNextPage: boolean;
      isFetchingNextPage: boolean;
      kind: "ready";
      onEndReached: () => void;
    }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" };

type CategoryMeta = {
  labelKey: "feature" | "fix" | "improvement";
  variant: "info" | "success" | "warning";
};

type ChangelogListContext = {
  isFetchingNextPage: boolean;
  loadingLabel: string;
};

type ChangelogPopoverContentProps = {
  locale: ChangelogLocale;
  onRetry: () => void;
  state: ChangelogPopoverState;
};

const CATEGORY_META = {
  feature: { labelKey: "feature", variant: "success" },
  fix: { labelKey: "fix", variant: "warning" },
  improvement: { labelKey: "improvement", variant: "info" },
} as const satisfies Record<ChangelogCategory, CategoryMeta>;

const LIST_HEIGHT = "min(60vh, 26rem)";
const SKELETON_COUNT = 4;

export function ChangelogPopoverContent({ locale, onRetry, state }: ChangelogPopoverContentProps) {
  const t = useTranslations("changelog");

  return (
    <div className="flex w-full flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3.5 py-3">
        <UiIcon className="text-primary" name="sparkles" size={16} />
        <h2 className="font-heading text-sm font-medium text-foreground">{t("title")}</h2>
      </header>
      <ChangelogPopoverBody locale={locale} onRetry={onRetry} state={state} />
    </div>
  );
}

function ChangelogEntryRow({ entry }: { entry: ChangelogEntryView }) {
  const tCategory = useTranslations("changelog.category");
  const meta = CATEGORY_META[entry.category];

  return (
    <article className="flex flex-col gap-1.5 border-b border-border/50 px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <Badge variant={meta.variant}>{tCategory(meta.labelKey)}</Badge>
        {entry.version === null ? null : (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">
            {entry.version}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{entry.title}</p>
      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{entry.body}</p>
    </article>
  );
}

function ChangelogGroupHeader({ label }: { label: string }) {
  return (
    <div className="border-b border-border/60 bg-popover px-3.5 py-2 text-xs font-medium tracking-wide text-muted-foreground">
      {label}
    </div>
  );
}

function ChangelogListFooter({ context }: { context?: ChangelogListContext }) {
  if (context === undefined || !context.isFetchingNextPage) return null;

  return (
    <div
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-t border-border/50 px-3.5 py-3 text-xs text-muted-foreground"
      data-slot="changelog-loading-more"
    >
      <UiIcon className="animate-spin" name="refresh" size={14} />
      {context.loadingLabel}
    </div>
  );
}

function ChangelogPopoverBody({ locale, onRetry, state }: ChangelogPopoverContentProps) {
  const t = useTranslations("changelog.states");

  if (state.kind === "loading") {
    return <ChangelogSkeletonList />;
  }

  if (state.kind === "error") {
    return (
      <div
        aria-live="assertive"
        className="flex flex-col items-center gap-3 px-6 py-10 text-center"
        role="alert"
      >
        <UiIcon className="text-muted-foreground" name="alert-circle" size={22} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{t("error.title")}</p>
          <p className="text-xs text-muted-foreground">{t("error.description")}</p>
        </div>
        <Button onClick={onRetry} size="sm" variant="secondary">
          <UiIcon name="refresh" size={14} />
          {t("error.retry")}
        </Button>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <UiIcon className="text-muted-foreground" name="bell" size={22} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground">{t("empty.description")}</p>
        </div>
      </div>
    );
  }

  const { groupCounts, groupLabels } = groupEntriesByDate({ entries: state.entries, locale });

  return (
    <GroupedVirtuoso
      components={{ Footer: ChangelogListFooter }}
      context={{ isFetchingNextPage: state.isFetchingNextPage, loadingLabel: t("loadingMore") }}
      endReached={() => {
        if (state.hasNextPage && !state.isFetchingNextPage) state.onEndReached();
      }}
      groupContent={(groupIndex) => {
        const label = groupLabels[groupIndex];
        if (label === undefined) return null;
        return <ChangelogGroupHeader label={label} />;
      }}
      groupCounts={groupCounts}
      itemContent={(index) => {
        const entry = state.entries[index];
        if (entry === undefined) return null;
        return <ChangelogEntryRow entry={entry} />;
      }}
      style={{ height: LIST_HEIGHT }}
    />
  );
}

function ChangelogSkeletonList() {
  return (
    <div aria-busy className="flex flex-col">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div className="flex flex-col gap-2 border-b border-border/50 px-3.5 py-3" key={index}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

function groupEntriesByDate({
  entries,
  locale,
}: {
  entries: readonly ChangelogEntryView[];
  locale: ChangelogLocale;
}): { groupCounts: number[]; groupLabels: string[] } {
  const groupCounts: number[] = [];
  const groupLabels: string[] = [];

  for (const entry of entries) {
    const label = formatDateLong(entry.publishedAt, locale);
    const lastIndex = groupCounts.length - 1;

    if (groupLabels[lastIndex] === label) {
      groupCounts[lastIndex] = (groupCounts[lastIndex] ?? 0) + 1;
      continue;
    }

    groupLabels.push(label);
    groupCounts.push(1);
  }

  return { groupCounts, groupLabels };
}
