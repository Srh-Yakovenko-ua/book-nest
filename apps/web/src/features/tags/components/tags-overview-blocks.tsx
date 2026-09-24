"use client";

import type { TagColor, TagsSummaryView, TagType } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { AttentionBlock } from "@/components/attention-block";
import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

import {
  formatTagShare,
  tagAttentionState,
  tagColorRows,
  tagTypeRows,
  type TagUsageKey,
  tagUsageRows,
} from "../model/tags-summary";
import { TAG_COLOR_SWATCH, TagColorSwatchButton } from "./tag-color-swatch";

type TagsAttentionBlockProps = {
  isShowingUnused: boolean;
  onShowUnused: () => void;
  summary: TagsSummaryView;
};

type TagsPaletteBlockProps = {
  onToggleColor: (color: TagColor) => void;
  selectedColors: readonly TagColor[];
  summary: TagsSummaryView;
};

type TagsStructureBlockProps = {
  onToggleType: (type: TagType) => void;
  selectedTypes: readonly TagType[];
  summary: TagsSummaryView;
};

const TOGGLE_CLASS =
  "cursor-pointer rounded-lg transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-secondary/80 aria-pressed:bg-secondary aria-pressed:ring-1 aria-pressed:ring-primary/50";

const TAG_UNUSED_ATTENTION_ID = "unused";

const TAG_TYPE_ROW = {
  className:
    "grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5 px-2 py-1.5 text-left",
  icons: {
    atmosphere: "sparkles",
    character: "users-round",
    custom: "hash",
    format: "file-text",
    theme: "book-open-text",
    trope: "repeat-2",
  } satisfies Record<TagType, UiIconName>,
  tile: {
    base: "row-span-2 grid size-8 place-items-center rounded-lg",
    empty: "bg-muted text-muted-foreground",
    filled: "bg-accent/40 text-accent-foreground",
  },
} as const;

const TAG_USAGE = {
  categories: {
    booksOnly: { icon: "book", swatch: "bg-primary" },
    both: { icon: "link", swatch: "bg-primary/35" },
    charactersOnly: { icon: "user-round", swatch: "bg-primary/65" },
    unused: { icon: "circle-slash", swatch: "bg-muted-foreground/40" },
  } satisfies Record<TagUsageKey, { icon: UiIconName; swatch: string }>,
  row: "grid grid-cols-[0.5rem_1rem_minmax(0,1fr)] items-center gap-x-2",
  track: "flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted",
} as const;

export function TagsAttentionBlock({
  isShowingUnused,
  onShowUnused,
  summary,
}: TagsAttentionBlockProps) {
  const t = useTranslations("tags.sidebar.attention");
  const attention = tagAttentionState(summary);

  return (
    <AttentionBlock
      activeId={isShowingUnused ? TAG_UNUSED_ATTENTION_ID : null}
      allClearLabel={t("allUsed")}
      isLoading={false}
      items={
        attention.kind === "allUsed"
          ? []
          : [
              {
                detail: t("detail"),
                icon: "circle-slash",
                id: TAG_UNUSED_ATTENTION_ID,
                label: t("unused", { count: attention.count }),
                toneClass: "text-warning",
              },
            ]
      }
      onSelect={onShowUnused}
      title={t("title")}
    />
  );
}

export function TagsPaletteBlock({
  onToggleColor,
  selectedColors,
  summary,
}: TagsPaletteBlockProps) {
  const t = useTranslations("tags");

  return (
    <OverviewBlock title={t("sidebar.palette.title")}>
      <ul className={TAG_COLOR_SWATCH.grid}>
        {tagColorRows(summary, selectedColors).map((row) => {
          const isEmpty = row.count === 0;
          const color = t(`colors.${row.color}`);
          return (
            <li key={row.color}>
              <TagColorSwatchButton
                aria-label={t("sidebar.palette.swatch", { color, count: row.count })}
                aria-pressed={row.isSelected}
                caption={
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isEmpty ? "text-muted-foreground" : "font-medium text-ink",
                    )}
                  >
                    {t("sidebar.palette.count", { count: row.count })}
                  </span>
                }
                color={row.color}
                isMuted={isEmpty}
                isSelected={row.isSelected}
                onClick={() => onToggleColor(row.color)}
                tooltip={t("sidebar.palette.tooltip", { color, count: row.count })}
              />
            </li>
          );
        })}
      </ul>
    </OverviewBlock>
  );
}

export function TagsStructureBlock({
  onToggleType,
  selectedTypes,
  summary,
}: TagsStructureBlockProps) {
  const t = useTranslations("tags");
  const locale = useLocale();

  return (
    <OverviewBlock title={t("sidebar.structure.title")}>
      <ul className="-mx-2 flex flex-col gap-0.5">
        {tagTypeRows(summary, selectedTypes).map((row) => {
          const share = formatTagShare(row.share, locale);
          return (
            <li key={row.type}>
              <button
                aria-label={t("sidebar.structure.row", {
                  count: row.count,
                  share,
                  type: t(`types.${row.type}`),
                })}
                aria-pressed={row.isSelected}
                className={cn(TOGGLE_CLASS, TAG_TYPE_ROW.className)}
                onClick={() => onToggleType(row.type)}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    TAG_TYPE_ROW.tile.base,
                    row.isEmpty ? TAG_TYPE_ROW.tile.empty : TAG_TYPE_ROW.tile.filled,
                  )}
                >
                  <UiIcon name={TAG_TYPE_ROW.icons[row.type]} size={16} />
                </span>
                <ShareLine
                  count={row.count}
                  isMuted={row.isEmpty}
                  label={t(`types.${row.type}`)}
                  share={share}
                />
                <ShareBar isMuted={row.isEmpty} share={row.share} />
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewBlock>
  );
}

export function TagsUsageBlock({ summary }: { summary: TagsSummaryView }) {
  const t = useTranslations("tags.sidebar.usage");
  const locale = useLocale();
  const rows = tagUsageRows(summary);

  return (
    <OverviewBlock title={t("title")}>
      <span aria-hidden className={TAG_USAGE.track}>
        {rows
          .filter((row) => row.share > 0)
          .map((row) => (
            <span
              className={cn("h-full", TAG_USAGE.categories[row.key].swatch)}
              data-segment={row.key}
              key={row.key}
              style={{ width: `${row.share * 100}%` }}
            />
          ))}
      </span>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const isMuted = row.count === 0;
          return (
            <li className={TAG_USAGE.row} key={row.key}>
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  TAG_USAGE.categories[row.key].swatch,
                  isMuted && "opacity-40",
                )}
              />
              <UiIcon
                aria-hidden
                className={isMuted ? "text-muted-foreground" : "text-ink"}
                name={TAG_USAGE.categories[row.key].icon}
                size={16}
              />
              <ShareLine
                count={row.count}
                isMuted={isMuted}
                label={t(row.key)}
                share={formatTagShare(row.share, locale)}
              />
            </li>
          );
        })}
      </ul>
    </OverviewBlock>
  );
}

function OverviewBlock({ children, title }: { children: ReactNode; title: string }) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="sidebar-card-leaf flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <h2 className="font-heading text-sm font-semibold text-ink" id={headingId}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ShareBar({ isMuted, share }: { isMuted: boolean; share: number }) {
  return (
    <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span
        className={cn("block h-full rounded-full", isMuted ? "bg-transparent" : "bg-primary")}
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}

function ShareLine({
  count,
  isMuted,
  label,
  share,
}: {
  count: number;
  isMuted: boolean;
  label: string;
  share: string;
}) {
  const t = useTranslations("tags.sidebar");

  return (
    <span
      className={cn(
        "flex items-baseline justify-between gap-2 text-sm",
        isMuted ? "text-muted-foreground" : "text-ink",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {t.rich("countShare", {
          count,
          share,
          strong: (chunks) => (
            <span className={cn("font-semibold", !isMuted && "text-ink")}>{chunks}</span>
          ),
        })}
      </span>
    </span>
  );
}
