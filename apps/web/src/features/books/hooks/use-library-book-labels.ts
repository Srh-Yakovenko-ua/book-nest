"use client";

import { useTranslations } from "next-intl";

import type { LibraryBookLabels } from "../model/library-book";

import { useGenres } from "../api/use-genres";

export function useLibraryBookLabels(): LibraryBookLabels {
  const t = useTranslations("books.library");
  const tFormat = useTranslations("books.format.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tAgeCategory = useTranslations("books.classification.ageCategoryLabels");
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  return {
    ageBadge18Plus: tAgeCategory("18_plus"),
    borrowedFrom: (name) => t("card.borrowedFrom", { name }),
    formatLabel: (value) => tFormat(value),
    genreName: (key) => genreNameByKey.get(key) ?? key,
    lentTo: (name) => t("card.lentTo", { name }),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value) => t("meta.pages", { value }),
    progressAriaLabel: (current, total) => t("progress.ariaLabel", { current, total }),
    progressUnit: t("progress.unit"),
    ratingLabel: (value) => t("rating.ariaLabel", { value }),
    seriesPosition: (position, total) => t("card.seriesPosition", { position, total }),
    statusLabel: (value) => tStatus(value),
  };
}
