"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import type { UseTagQueryResult } from "../model/use-tag-query";

import { committedTagSearch } from "../model/tags-query";

type ActiveChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type TagsActiveChipsProps = {
  query: UseTagQueryResult;
};

export function TagsActiveChips({ query }: TagsActiveChipsProps) {
  const t = useTranslations("tags.activeFilters");
  const tType = useTranslations("tags.types");
  const tColor = useTranslations("tags.colors");
  const { state } = query;
  const search = committedTagSearch(state.q);

  const chips: ActiveChip[] = [
    ...(search === ""
      ? []
      : [{ key: "q", label: t("search", { query: search }), onRemove: query.clearSearch }]),
    ...state.type.map((type) => ({
      key: `type-${type}`,
      label: tType(type),
      onRemove: () => query.toggleType(type),
    })),
    ...state.color.map((color) => ({
      key: `color-${color}`,
      label: tColor(color),
      onRemove: () => query.toggleColor(color),
    })),
  ];

  if (chips.length === 0) return null;

  return (
    <div aria-label={t("label")} className="flex flex-wrap items-center gap-2" role="group">
      {chips.map((chip) => (
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-tag py-0.5 pr-0.5 pl-3 text-sm font-medium text-tag-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={t("remove", { label: chip.label })}
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border border-transparent text-tag-foreground opacity-60 transition-[opacity,background-color] hover:bg-ink/10 hover:opacity-100 focus-visible:border-ring focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={chip.onRemove}
            type="button"
          >
            <UiIcon className="size-3" name="x" size={12} />
          </button>
        </span>
      ))}
      <button
        className="cursor-pointer rounded-sm border border-transparent px-1 py-0.5 text-sm font-semibold text-error outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={query.clearAll}
        type="button"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}
