"use client";

import { useTranslations } from "next-intl";

import type { SeriesSelectOption } from "../model/series-select-option";

export function SeriesSelectMeta({ series }: { series: SeriesSelectOption }) {
  const t = useTranslations("series.card");
  const authors = series.authors.length === 0 ? t("authorsUnknown") : series.authors.join(", ");

  return (
    <>
      <span className="truncate text-xs text-muted-foreground">{authors}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("books", { count: series.booksCount })}
      </span>
    </>
  );
}
