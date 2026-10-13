"use client";

import type { SpeciesUsage } from "@app/shared";

import { isSpeciesInUse } from "@app/shared";
import { useTranslations } from "next-intl";

export function OwnSpeciesUsage({ usage }: { usage: SpeciesUsage }) {
  const t = useTranslations("species.usage");

  if (!isSpeciesInUse(usage)) return t("unused");

  const summary = t("summary", {
    bookOverrides: usage.bookOverrides,
    characters: usage.characters,
  });
  const trashedParts = [
    usage.trashedCharacters === 0
      ? null
      : t("trashedCharacters", { count: usage.trashedCharacters }),
    usage.trashedBookOverrides === 0
      ? null
      : t("trashedBookOverrides", { count: usage.trashedBookOverrides }),
  ].filter((part) => part !== null);

  if (trashedParts.length === 0) return summary;

  return (
    <>
      <span className="block">{summary}</span>
      <span className="block">{t("trashed", { parts: trashedParts.join(" · ") })}</span>
    </>
  );
}
