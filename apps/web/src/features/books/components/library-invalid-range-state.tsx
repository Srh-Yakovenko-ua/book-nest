import { useFormatter, useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";

import type { LibraryInvalidRange } from "../model/use-library-query";

export function LibraryInvalidRangeState({ onClear, ranges }: LibraryInvalidRange) {
  const t = useTranslations("books.library.invalidRange");
  const format = useFormatter();

  const rangeLabels = ranges.map((range) => t(`ranges.${range}`));

  const state: EmptyStateEntry = {
    desc: t("description", { ranges: format.list(rangeLabels, { type: "conjunction" }) }),
    illu: "empty-search",
    illuSize: "sm",
    primary: { icon: "x", label: t("clear", { count: ranges.length }) },
    title: t("title"),
  };

  return <EmptyState onPrimary={onClear} state={state} />;
}
