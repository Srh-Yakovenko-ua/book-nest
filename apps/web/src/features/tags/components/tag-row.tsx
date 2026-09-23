"use client";

import type { TagCatalogListItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

import { tagColorStyle } from "../model/tag-color";

type TagRowProps = {
  onDelete: () => void;
  onEdit: () => void;
  tag: TagCatalogListItem;
};

type UsageMetric = {
  icon: UiIconName;
  key: "books" | "characters" | "usage";
  value: number;
};

export function TagRow({ onDelete, onEdit, tag }: TagRowProps) {
  const t = useTranslations("tags.row");
  const tType = useTranslations("tags.types");
  const tColor = useTranslations("tags.colors");
  const locale = useLocale();

  const metrics: UsageMetric[] = [
    { icon: "book", key: "books", value: tag.booksCount },
    { icon: "user", key: "characters", value: tag.charactersCount },
    { icon: "layers", key: "usage", value: tag.usageCount },
  ];

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-card transition-colors duration-150 hover:border-accent-border md:flex-row md:items-center md:gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3
            className="inline-flex max-w-full items-center rounded-full border px-3 py-1 text-sm font-medium"
            style={tagColorStyle(tag.color)}
          >
            <span className="truncate">{tag.name}</span>
          </h3>
          <span className="text-xs text-muted-foreground">{tType(tag.type)}</span>
          <span className="sr-only">{t("color", { color: tColor(tag.color) })}</span>
        </div>
        {tag.description === null ? null : (
          <p className="truncate text-sm text-muted-foreground" title={tag.description}>
            {tag.description}
          </p>
        )}
      </div>

      <dl className="flex shrink-0 items-center gap-4 text-sm">
        {metrics.map((metric) => (
          <div className="flex items-center gap-1.5" key={metric.key}>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <UiIcon aria-hidden className="text-icon" name={metric.icon} size={14} />
              <span>{t(metric.key)}</span>
            </dt>
            <dd className="font-semibold text-foreground tabular-nums">
              {formatNumber(metric.value, locale)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex shrink-0 items-center gap-1.5 max-md:self-end">
        <Button
          aria-label={t("edit", { name: tag.name })}
          onClick={onEdit}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="edit" size={16} />
        </Button>
        <Button
          aria-label={t("delete", { name: tag.name })}
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="trash" size={16} />
        </Button>
      </div>
    </article>
  );
}
