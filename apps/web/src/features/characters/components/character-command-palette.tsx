"use client";

import type { BookCharacterSummaryQuery } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { normalizeSearchQuery } from "@/components/debounced-search-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { BOOK_CHARACTER_LOOKUP, useBookCharacterLookup } from "../api/use-book-characters";
import { explicitImportance } from "../model/character-options";
import { rosterDisplayName } from "../model/characters-roster-query";

const PALETTE_PAGE_SIZE = 10;

type CharacterCommandPaletteProps = {
  bookId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (characterId: string) => void;
  open: boolean;
  readingContext: BookCharacterSummaryQuery;
};

export function CharacterCommandPalette({
  bookId,
  onOpenChange,
  onSelect,
  open,
  readingContext,
}: CharacterCommandPaletteProps) {
  const t = useTranslations("characters.palette");
  const tImportance = useTranslations("characters.importance");
  const [query, setQuery] = useState("");

  const normalizedQuery = normalizeSearchQuery(query);
  const roster = useBookCharacterLookup({
    bookId,
    pageSize: PALETTE_PAGE_SIZE,
    query: normalizedQuery,
    readingContext,
  });

  const results = roster.data?.items ?? [];

  function handleSelect(characterId: string) {
    onOpenChange(false);
    setQuery("");
    onSelect(characterId);
  }

  return (
    <CommandDialog
      description={t("title")}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
      open={open}
      title={t("title")}
    >
      <Command shouldFilter={false}>
        <CommandInput onValueChange={setQuery} placeholder={t("placeholder")} value={query} />
        <CommandList>
          {normalizedQuery.length < BOOK_CHARACTER_LOOKUP.minQueryLength ? (
            <CommandEmpty>{t("empty")}</CommandEmpty>
          ) : results.length === 0 && !roster.isFetching ? (
            <CommandEmpty>{t("noResults")}</CommandEmpty>
          ) : null}

          {results.map((candidate) => {
            const importance = explicitImportance(candidate.importance);
            const name = rosterDisplayName(candidate);
            const avatarUrl = (candidate.portrait ?? candidate.avatar)?.urls.thumb ?? null;

            return (
              <CommandItem
                key={candidate.id}
                onSelect={() => handleSelect(candidate.characterId)}
                value={candidate.id}
              >
                <Avatar className="size-7" size="sm">
                  {avatarUrl === null ? null : <AvatarImage alt={name} src={avatarUrl} />}
                  <AvatarFallback>{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {importance === null ? null : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tImportance(importance)}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
