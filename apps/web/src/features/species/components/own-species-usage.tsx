"use client";

import type { SpeciesUsage } from "@app/shared";

import { useTranslations } from "next-intl";

export function OwnSpeciesUsage({ usage }: { usage: SpeciesUsage }) {
  const t = useTranslations("species.usage");

  if (usage.characters === 0 && usage.bookOverrides === 0) return t("unused");

  return t("summary", {
    bookOverrides: usage.bookOverrides,
    characters: usage.characters,
    trashed: usage.trashed,
  });
}
