"use client";

import { useTranslations } from "next-intl";

import { Multiselect, type MultiselectOption } from "@/components/ui/multiselect";

import { useGenres } from "../api/use-genres";
import { useRecentGenres } from "../api/use-recent-genres";
import { BOOK_GENRES_MAX } from "../model/book-classification-fields";

type GenresFieldProps = {
  disabled?: boolean;
  id?: string;
  onChange: (next: string[]) => void;
  value: string[];
};

export function GenresField({ disabled, id, onChange, value }: GenresFieldProps) {
  const t = useTranslations("books");
  const genres = useGenres();
  const recentGenres = useRecentGenres();

  const genreList = genres.data ?? [];
  const genreNameByKey = new Map(genreList.map((genre) => [genre.key, genre.name]));
  const atMax = value.length >= BOOK_GENRES_MAX;

  const recentHeading = t("classification.genresRecentHeading");
  const recentKeys = (recentGenres.data ?? [])
    .map((genre) => genre.key)
    .filter((key) => genreNameByKey.has(key))
    .filter((key) => !atMax || value.includes(key));
  const recentKeySet = new Set(recentKeys);

  const recentOptions: MultiselectOption[] = recentKeys.map((key) => ({
    group: recentHeading,
    label: genreNameByKey.get(key) ?? key,
    value: key,
  }));

  const catalogOptions: MultiselectOption[] = genreList
    .filter((genre) => !recentKeySet.has(genre.key))
    .filter((genre) => !atMax || value.includes(genre.key))
    .map((genre) => ({ group: genre.groupName, label: genre.name, value: genre.key }));

  const options: MultiselectOption[] = [...recentOptions, ...catalogOptions];
  for (const key of value) {
    if (options.some((option) => option.value === key)) continue;
    options.push({ label: genreNameByKey.get(key) ?? key, value: key });
  }

  return (
    <Multiselect
      disabled={disabled || genres.isPending}
      emptyText={
        genres.isPending ? t("classification.genresLoading") : t("classification.genresEmpty")
      }
      id={id}
      onValueChange={(next) => onChange(next.slice(0, BOOK_GENRES_MAX))}
      options={options}
      placeholder={t("classification.genresPlaceholder")}
      searchPlaceholder={t("classification.genresSearch")}
      value={value}
    />
  );
}
