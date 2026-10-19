"use client";

import type { Nullable } from "@app/shared";
import type { Ref } from "react";

import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { normalizeSearchQuery } from "@/components/debounced-search-input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLockedWheelScroll } from "@/hooks/use-locked-wheel-scroll";

import type { RelationshipParticipant } from "../model/relationship-form-schema";

import {
  RELATIONSHIP_PARTICIPANT_SEARCH,
  useRelationshipParticipantSearch,
} from "../api/use-relationship-participant-search";
import { RelationshipParticipantChip } from "./relationship-participant-chip";

const PARTICIPANT_PICKER = {
  debounceMs: 300,
} as const;

type RelationshipParticipantPickerProps = {
  bookId: Nullable<string>;
  describedBy?: string;
  excludedIds: readonly string[];
  id: string;
  invalid: boolean;
  onBlur: () => void;
  onChange: (participant: RelationshipParticipant) => void;
  ref?: Ref<HTMLButtonElement>;
  value: Nullable<RelationshipParticipant>;
};

export function RelationshipParticipantPicker({
  bookId,
  describedBy,
  excludedIds,
  id,
  invalid,
  onBlur,
  onChange,
  ref,
  value,
}: RelationshipParticipantPickerProps) {
  const t = useTranslations("relationships.editor.picker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useLockedWheelScroll();
  const debouncedQuery = useDebouncedValue(
    normalizeSearchQuery(query),
    PARTICIPANT_PICKER.debounceMs,
  );
  const search = useRelationshipParticipantSearch({
    bookId,
    enabled: open,
    excludedIds,
    query: debouncedQuery,
  });
  const hasMatches = search.bookMatches.length > 0 || search.otherMatches.length > 0;

  function toggle(next: boolean) {
    setOpen(next);
    if (next) return;
    setQuery("");
    onBlur();
  }

  function pick(participant: RelationshipParticipant) {
    onChange(participant);
    toggle(false);
  }

  function renderOption(participant: RelationshipParticipant) {
    return (
      <CommandItem
        className="cursor-pointer"
        data-checked={participant.id === value?.id}
        key={participant.id}
        onSelect={() => pick(participant)}
        value={participant.id}
      >
        <RelationshipParticipantChip participant={participant} />
      </CommandItem>
    );
  }

  return (
    <Popover onOpenChange={toggle} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-invalid={invalid}
          className="h-10 w-full justify-between gap-2 px-3 font-normal"
          data-relationship-autofocus=""
          id={id}
          ref={ref}
          role="combobox"
          type="button"
          variant="outline"
        >
          {value === null ? (
            <span className="truncate text-muted-foreground">{t("placeholder")}</span>
          ) : (
            <RelationshipParticipantChip participant={value} />
          )}
          <ChevronsUpDown aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            aria-label={t("search")}
            onValueChange={setQuery}
            placeholder={t("search")}
            value={query}
          />
          <CommandList ref={listRef}>
            {search.isError ? (
              <p className="px-3 py-4 text-center text-sm text-error" role="alert">
                {t("error")}
              </p>
            ) : null}
            {!search.isError && !hasMatches ? (
              <CommandEmpty>{search.isFetching ? t("loading") : t("empty")}</CommandEmpty>
            ) : null}
            {search.bookMatches.length === 0 ? null : (
              <CommandGroup heading={t("inBook")}>
                {search.bookMatches.map(renderOption)}
              </CommandGroup>
            )}
            {search.otherMatches.length === 0 ? null : (
              <CommandGroup heading={t("all")}>
                {search.otherMatches.map(renderOption)}
              </CommandGroup>
            )}
          </CommandList>
          {bookId === null || search.isSearching ? null : (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {t("searchHint", { min: RELATIONSHIP_PARTICIPANT_SEARCH.minQueryLength })}
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
