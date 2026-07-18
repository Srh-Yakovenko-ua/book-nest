"use client";

import type { SeriesOrderPositionView } from "@app/shared";

import { useTranslations } from "next-intl";

type SeriesOrderSequenceProps = {
  items: SeriesOrderPositionView[];
  label: string;
};

export function SeriesOrderSequence({ items, label }: SeriesOrderSequenceProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ol className="flex flex-col gap-0.5">
        {items.map((item, index) => (
          <li className="flex items-baseline gap-1.5 text-xs" key={item.bookId}>
            <span aria-hidden className="shrink-0 text-muted-foreground tabular-nums">
              {index + 1}.
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground/90" title={item.title}>
              {item.title}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {item.seriesPosition === null
                ? t("seriesPositionUnknown")
                : t("seriesPosition", { position: item.seriesPosition })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
