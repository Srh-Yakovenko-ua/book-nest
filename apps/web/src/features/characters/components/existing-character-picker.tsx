"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCharacterSuggestions } from "../api/use-character-suggestions";

type ExistingCharacterPickerProps = {
  bookId: string;
  onCreateNew: () => void;
  onPick: (characterId: string) => void;
};

export function ExistingCharacterPicker({
  bookId,
  onCreateNew,
  onPick,
}: ExistingCharacterPickerProps) {
  const t = useTranslations("characters.existing");
  const [search, setSearch] = useState("");
  const suggestions = useCharacterSuggestions(bookId, search);

  const results = suggestions.data?.suggestions ?? [];

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput
        clearLabel={t("searchLabel")}
        label={t("searchLabel")}
        onClear={() => setSearch("")}
        onSearch={setSearch}
        placeholder={t("searchPlaceholder")}
        value={search}
      />

      <div aria-busy={suggestions.isFetching} className="flex flex-col gap-2">
        {suggestions.isFetching && results.length === 0 ? (
          <>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </>
        ) : null}

        {!suggestions.isFetching && search.trim().length >= 2 && results.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {results.map((candidate) => (
            <li
              className="flex items-center gap-3 rounded-lg border border-border p-2.5"
              key={candidate.id}
            >
              <Avatar className="size-9" size="sm">
                {candidate.avatar === null ? null : (
                  <AvatarImage alt={candidate.name} src={candidate.avatar.urls.thumb} />
                )}
                <AvatarFallback>{candidate.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {candidate.name}
                </span>
                {candidate.species === null ? null : (
                  <span className="truncate text-xs text-muted-foreground">
                    {candidate.species}
                  </span>
                )}
              </div>
              <Button onClick={() => onPick(candidate.id)} size="sm" type="button">
                {t("link")}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <Button className="self-start" onClick={onCreateNew} type="button" variant="secondary">
        <UiIcon name="plus" size={16} />
        {t("createNew")}
      </Button>
    </div>
  );
}
