"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";

type CharactersEmptyStateProps = {
  onAdd: () => void;
};

type CharactersNoResultsProps = {
  onClear: () => void;
};

export function CharactersEmptyState({ onAdd }: CharactersEmptyStateProps) {
  const t = useTranslations("characters.empty");

  const state: EmptyStateEntry = {
    desc: t("description"),
    illu: "empty-authors",
    primary: { icon: "plus", label: t("add") },
    title: t("title"),
  };

  return <EmptyState onPrimary={onAdd} state={state} />;
}

export function CharactersNoResults({ onClear }: CharactersNoResultsProps) {
  const t = useTranslations("characters.noResults");

  const state: EmptyStateEntry = {
    desc: t("description"),
    illu: "empty-search",
    primary: { icon: "x", label: t("clear") },
    title: t("title"),
  };

  return <EmptyState onPrimary={onClear} state={state} />;
}
