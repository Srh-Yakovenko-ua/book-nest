"use client";

import type { TagCatalogListItem } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type TagUsageProps = {
  className?: string;
  tag: TagCatalogListItem;
};

type UsageMetric = {
  icon: UiIconName;
  key: "books" | "characters";
  value: number;
};

export function TagUsage({ className, tag }: TagUsageProps) {
  const t = useTranslations("tags.item");
  const locale = useLocale();

  if (tag.booksCount === 0 && tag.charactersCount === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{t("unused")}</p>;
  }

  const metrics: UsageMetric[] = [
    { icon: "book", key: "books", value: tag.booksCount },
    { icon: "user", key: "characters", value: tag.charactersCount },
  ];

  return (
    <dl className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", className)}>
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
  );
}
