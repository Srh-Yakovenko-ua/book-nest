"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { useBook } from "@/features/books";

import type { EntitySearchResult } from "./entity-search-select";

import { useCharacterBookOptions } from "../api/use-character-book-options";
import { EntitySearchSelect } from "./entity-search-select";

type CharactersBookFilterProps = {
  onChange: (value: Nullable<string>) => void;
  value: Nullable<string>;
};

export function CharactersBookFilter({ onChange, value }: CharactersBookFilterProps) {
  const t = useTranslations("characters.catalog.filters");
  const tActive = useTranslations("characters.activeFilters");
  const selected = useBook(value ?? "", { enabled: value !== null });

  return (
    <EntitySearchSelect
      label={t("book")}
      labels={{
        clear: t("clearBook"),
        empty: t("bookEmpty"),
        placeholder: t("anyBook"),
        search: t("bookSearch"),
        searching: t("bookSearching"),
      }}
      onChange={onChange}
      selectedName={selected.data?.title ?? (selected.isError ? tActive("unknown") : undefined)}
      useSearch={useBookSearchResult}
      value={value}
    />
  );
}

function useBookSearchResult(query: string): EntitySearchResult {
  const books = useCharacterBookOptions(query);

  return {
    fetchNextPage: () => void books.fetchNextPage(),
    hasNextPage: books.hasNextPage,
    isFetching: books.isFetching,
    isFetchingNextPage: books.isFetchingNextPage,
    items: (books.data?.pages ?? [])
      .flatMap((page) => page.items)
      .map((book) => ({
        detail: book.authors.map((author) => author.name).join(", "),
        id: book.id,
        name: book.title,
      })),
  };
}
