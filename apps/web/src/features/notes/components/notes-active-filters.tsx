"use client";

import { NoteCategorySchema, SeriesReadingStateSchema, SeriesStatusSchema } from "@app/shared";
import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { LibraryActiveFilters, useGenres } from "@/features/books";
import { assertNever } from "@/lib/assert-never";

import type { NotesArchiveFacets } from "../api/use-notes-facets";
import type { NotesActiveFilterEntry } from "../model/notes-archive-query";

type ActiveFiltersWithGenresProps = NotesActiveFiltersProps & {
  genreNames: ReadonlyMap<string, string>;
};

type NotesActiveFiltersProps = {
  entries: NotesActiveFilterEntry[];
  facets: NotesArchiveFacets | undefined;
  onClearAll: () => void;
  onRemove: (entry: NotesActiveFilterEntry) => void;
};

const NO_GENRE_NAMES: ReadonlyMap<string, string> = new Map();

const PRESENCE_MESSAGE_KEYS = {
  hasChapter: "chapter",
  hasPage: "page",
} as const;

export function NotesActiveFilters(props: NotesActiveFiltersProps) {
  const hasGenreFilter = props.entries.some(
    (entry) => entry.kind === "value" && entry.dimension === "genre",
  );

  if (hasGenreFilter) return <ActiveFiltersWithGenreNames {...props} />;
  return <ActiveFilterChips {...props} genreNames={NO_GENRE_NAMES} />;
}

function ActiveFilterChips({
  entries,
  facets,
  genreNames,
  onClearAll,
  onRemove,
}: ActiveFiltersWithGenresProps) {
  const t = useTranslations("notes.archive");
  const tLibrary = useTranslations("books.library.activeFilters");
  const tCategories = useTranslations("notes.categories");
  const tReading = useTranslations("series.readingFilter");
  const tStatus = useTranslations("series.status");

  function optionName(dimension: "author" | "book" | "series", value: string): string {
    if (facets === undefined) return t("activeFilters.loading");
    const option = facets.options[dimension].find((candidate) => candidate.value === value);
    return option?.label ?? t("activeFilters.notFound");
  }

  function valueLabel(entry: Extract<NotesActiveFilterEntry, { kind: "value" }>): string {
    const { dimension, value } = entry;
    switch (dimension) {
      case "author":
      case "book":
      case "series":
        return t(`activeFilters.${dimension}`, { name: optionName(dimension, value) });
      case "category": {
        const category = NoteCategorySchema.safeParse(value);
        const name = category.success ? tCategories(category.data) : value;
        return t("activeFilters.category", { name });
      }
      case "customCategory":
        return t("activeFilters.category", { name: value });
      case "genre":
        return t("activeFilters.genre", { name: genreNames.get(value) ?? value });
      case "reading": {
        const reading = SeriesReadingStateSchema.safeParse(value);
        return t("activeFilters.reading", {
          name: reading.success ? tReading(reading.data) : value,
        });
      }
      case "status": {
        const status = SeriesStatusSchema.safeParse(value);
        return t("activeFilters.status", {
          name: status.success ? tStatus(status.data) : value,
        });
      }
      default:
        return assertNever(dimension);
    }
  }

  function chipLabel(entry: NotesActiveFilterEntry): string {
    switch (entry.kind) {
      case "presence":
        return t(
          `presence.${PRESENCE_MESSAGE_KEYS[entry.dimension]}.${entry.value ? "yes" : "no"}`,
        );
      case "search":
        return tLibrary("search", { query: entry.query });
      case "value":
        return valueLabel(entry);
      default:
        return assertNever(entry);
    }
  }

  const chips: ActiveFilterChip[] = entries.map((entry) => ({
    key: entry.key,
    label: chipLabel(entry),
    onRemove: () => onRemove(entry),
  }));

  return <LibraryActiveFilters chips={chips} onClearAll={onClearAll} />;
}

function ActiveFiltersWithGenreNames(props: NotesActiveFiltersProps) {
  const genres = useGenres();
  const genreNames = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  return <ActiveFilterChips {...props} genreNames={genreNames} />;
}
