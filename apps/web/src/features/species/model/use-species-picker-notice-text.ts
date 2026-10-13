"use client";

import { SPECIES_SEARCH } from "@app/shared";
import { useTranslations } from "next-intl";

import type { SpeciesPickerNotice } from "./use-species-picker-model";

export function useSpeciesPickerNoticeText(): (notice: SpeciesPickerNotice) => string {
  const t = useTranslations("species.picker");
  return (notice) =>
    notice === "tooShort"
      ? t("notices.tooShort", { min: SPECIES_SEARCH.minQueryLength })
      : t(`notices.${notice}`);
}
