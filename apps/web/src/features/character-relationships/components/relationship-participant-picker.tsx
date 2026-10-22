"use client";

import type { Nullable } from "@app/shared";
import type { Ref } from "react";

import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { assertNever } from "@/lib/assert-never";

import type {
  RelationshipRosterSearch,
  RelationshipRosterSearchState,
} from "../api/use-relationship-roster-search";
import type { RelationshipParticipant } from "../model/relationship-form-schema";
import type { RelationshipPickerStatusMessage } from "./relationship-picker-status";

import { useRelationshipRosterSearch } from "../api/use-relationship-roster-search";
import { RelationshipParticipantChip } from "./relationship-participant-chip";
import {
  RelationshipPickerRetryItem,
  RelationshipPickerStatus,
} from "./relationship-picker-status";

const PARTICIPANT_PICKER = {
  searchMaxLength: 100,
} as const;

type ParticipantPick = (participant: RelationshipParticipant) => void;

type RelationshipParticipantPickerProps = {
  bookId: Nullable<string>;
  describedBy?: string;
  excludedIds: readonly string[];
  id: string;
  invalid: boolean;
  onBlur: () => void;
  onChange: ParticipantPick;
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

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) onBlur();
  }

  function pick(participant: RelationshipParticipant) {
    onChange(participant);
    toggle(false);
  }

  return (
    <Popover onOpenChange={toggle} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-invalid={invalid}
          className="h-11 w-full justify-between gap-2 px-3 font-normal sm:h-10"
          data-relationship-autofocus=""
          disabled={bookId === null}
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
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <ParticipantSearchPanel
          bookId={bookId}
          excludedIds={excludedIds}
          onPick={pick}
          selectedId={value?.id ?? null}
        />
      </PopoverContent>
    </Popover>
  );
}

function ParticipantResults({
  onPick,
  search,
  selectedId,
}: {
  onPick: ParticipantPick;
  search: RelationshipRosterSearch;
  selectedId: Nullable<string>;
}) {
  const t = useTranslations("relationships.editor.picker");
  const { state } = search;
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: search.hasNextPage,
    isFetchingNextPage: search.isFetchingNextPage,
    itemCount: state.kind === "results" ? state.participants.length : 0,
    onLoadMore: search.fetchNextPage,
  });

  return (
    <CommandList
      aria-busy={state.kind === "loading" || search.isFetchingNextPage}
      label={t("results")}
      onScroll={onScroll}
      ref={scrollRef}
    >
      {state.kind === "results"
        ? state.participants.map((participant) => (
            <CommandItem
              className="min-h-11 cursor-pointer sm:min-h-0"
              data-checked={participant.id === selectedId}
              disabled={state.isStale}
              key={participant.id}
              onSelect={() => onPick(participant)}
              value={participant.id}
            >
              <RelationshipParticipantChip participant={participant} />
            </CommandItem>
          ))
        : null}
      {state.kind === "error" || search.isLoadMoreError ? (
        <RelationshipPickerRetryItem onRetry={search.retry} />
      ) : null}
    </CommandList>
  );
}

function ParticipantSearchPanel({
  bookId,
  excludedIds,
  onPick,
  selectedId,
}: {
  bookId: Nullable<string>;
  excludedIds: readonly string[];
  onPick: ParticipantPick;
  selectedId: Nullable<string>;
}) {
  const t = useTranslations("relationships.editor.picker");
  const [query, setQuery] = useState("");
  const search = useRelationshipRosterSearch({ bookId, excludedIds, search: query });
  const term = query.trim();

  return (
    <Command label={t("search")} shouldFilter={false}>
      <CommandInput
        maxLength={PARTICIPANT_PICKER.searchMaxLength}
        onValueChange={setQuery}
        placeholder={t("search")}
        value={query}
      />
      <RelationshipPickerStatus
        loadMoreErrorText={t("loadMoreError")}
        message={toStatusMessage({ isBrowsing: term === "", state: search.state, t })}
        pagination={search}
      />
      <ParticipantResults
        key={`${bookId ?? ""}:${term}`}
        onPick={onPick}
        search={search}
        selectedId={selectedId}
      />
    </Command>
  );
}

function toStatusMessage({
  isBrowsing,
  state,
  t,
}: {
  isBrowsing: boolean;
  state: RelationshipRosterSearchState;
  t: ReturnType<typeof useTranslations<"relationships.editor.picker">>;
}): Nullable<RelationshipPickerStatusMessage> {
  switch (state.kind) {
    case "empty":
      return { text: isBrowsing ? t("emptyBook") : t("empty"), tone: "info" };
    case "error":
      return { text: t("error"), tone: "error" };
    case "hint":
      return { text: t("hint"), tone: "info" };
    case "loading":
      return { text: t("loading"), tone: "progress" };
    case "no-book":
      return { text: t("noBook"), tone: "info" };
    case "results":
      return null;
    default:
      return assertNever(state);
  }
}
