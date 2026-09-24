"use client";

import type { TagColor, TagsSummaryView, TagType } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { tagColorStyle } from "../model/tag-color";
import {
  formatTagShare,
  tagAttentionState,
  tagColorRows,
  tagTypeRows,
  tagUsageRows,
} from "../model/tags-summary";

type TagsAttentionBlockProps = {
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

export function TagsAttentionBlock({ onShowUnused, summary }: TagsAttentionBlockProps) {
  const t = useTranslations("tags.sidebar.attention");
  const attention = tagAttentionState(summary);

  return (
    <OverviewBlock title={t("title")}>
      {attention.kind === "allUsed" ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <UiIcon
            aria-hidden
            className="mt-0.5 shrink-0 text-success"
            name="check-circle"
            size={16}
          />
          {t("allUsed")}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("unused", { count: attention.count })}</p>
          <Button className="self-start" onClick={onShowUnused} size="sm" variant="secondary">
            <UiIcon aria-hidden name="filter" size={16} />
            {t("action")}
          </Button>
        </>
      )}
    </OverviewBlock>
  );
}

export function TagsPaletteBlock({
  onToggleColor,
  selectedColors,
  summary,
}: TagsPaletteBlockProps) {
  const t = useTranslations("tags");
  const locale = useLocale();

  return (
    <OverviewBlock title={t("sidebar.palette.title")}>
      <ul className="grid grid-cols-4 gap-2">
        {tagColorRows(summary, selectedColors).map((row) => (
          <li key={row.color}>
            <button
              aria-label={t("sidebar.palette.swatch", {
                color: t(`colors.${row.color}`),
                count: row.count,
              })}
              aria-pressed={row.isSelected}
              className={cn(
                TOGGLE_CLASS,
                "flex w-full flex-col items-center gap-1 px-1 py-2",
                row.count === 0 && "text-muted-foreground",
              )}
              onClick={() => onToggleColor(row.color)}
              title={t(`colors.${row.color}`)}
              type="button"
            >
              <span
                aria-hidden
                className={cn("size-7 rounded-full border", row.count === 0 && "opacity-60")}
                style={tagColorStyle(row.color)}
              />
              <span className="text-xs font-medium tabular-nums">
                {formatNumber(row.count, locale)}
              </span>
            </button>
          </li>
        ))}
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
                className={cn(TOGGLE_CLASS, "flex w-full flex-col gap-1.5 px-2 py-2 text-left")}
                onClick={() => onToggleType(row.type)}
                type="button"
              >
                <ShareLine
                  count={formatNumber(row.count, locale)}
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

  return (
    <OverviewBlock title={t("title")}>
      <ul className="flex flex-col gap-3">
        {tagUsageRows(summary).map((row) => (
          <li className="flex flex-col gap-1.5" key={row.key}>
            <ShareLine
              count={formatNumber(row.count, locale)}
              isMuted={row.count === 0}
              label={t(row.key)}
              share={formatTagShare(row.share, locale)}
            />
            <ShareBar isMuted={row.count === 0} share={row.share} />
          </li>
        ))}
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
  count: string;
  isMuted: boolean;
  label: string;
  share: string;
}) {
  return (
    <span
      className={cn(
        "flex items-baseline justify-between gap-2 text-sm",
        isMuted ? "text-muted-foreground" : "text-ink",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums">
        <span className="font-semibold">{count}</span>
        <span className="text-muted-foreground"> · {share}</span>
      </span>
    </span>
  );
}
