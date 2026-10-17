"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";

import type { CharacterDetailsMode } from "../model/character-details-context";

import { CharacterFactsList } from "./character-facts-list";

type CharacterFactsTabProps = {
  characterId: string;
  mode: CharacterDetailsMode;
  onChooseBook: Nullable<() => void>;
};

export function CharacterFactsTab({ characterId, mode, onChooseBook }: CharacterFactsTabProps) {
  const t = useTranslations("characters.facts");

  if (mode.kind === "book") {
    return <CharacterFactsList bookId={mode.bookId} characterId={characterId} />;
  }

  if (onChooseBook === null) {
    return (
      <EmptyState
        state={{
          desc: t("noAppearances.description"),
          illu: "empty-library",
          title: t("noAppearances.title"),
        }}
      />
    );
  }

  return (
    <EmptyState
      onPrimary={onChooseBook}
      state={{
        desc: t("noBook.description"),
        illu: "empty-library",
        primary: { icon: "book", label: t("noBook.action") },
        title: t("noBook.title"),
      }}
    />
  );
}
