"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useCharactersSearch } from "../api/use-characters-search";

type CharacterCommandPaletteProps = {
  contextBookId?: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (characterId: string) => void;
  open: boolean;
};

export function CharacterCommandPalette({
  contextBookId,
  onOpenChange,
  onSelect,
  open,
}: CharacterCommandPaletteProps) {
  const t = useTranslations("characters.palette");
  const [query, setQuery] = useState("");
  const search = useCharactersSearch({ contextBookId, query });

  const results = search.data?.items ?? [];
  const trimmed = query.trim();

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
          {trimmed.length < 2 ? (
            <CommandEmpty>{t("empty")}</CommandEmpty>
          ) : results.length === 0 && !search.isFetching ? (
            <CommandEmpty>{t("noResults")}</CommandEmpty>
          ) : null}

          {results.map((candidate) => (
            <CommandItem
              key={candidate.id}
              onSelect={() => handleSelect(candidate.id)}
              value={candidate.id}
            >
              <Avatar className="size-7" size="sm">
                {candidate.avatar === null ? null : (
                  <AvatarImage alt={candidate.name} src={candidate.avatar.urls.thumb} />
                )}
                <AvatarFallback>{candidate.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
              {candidate.species === null ? null : (
                <span className="shrink-0 text-xs text-muted-foreground">{candidate.species}</span>
              )}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
