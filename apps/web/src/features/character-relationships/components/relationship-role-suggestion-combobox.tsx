"use client";

import type { Nullable } from "@app/shared";
import type { KeyboardEvent, Ref } from "react";

import { CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { TruncatedText } from "@/components/truncated-text";
import { CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type {
  RelationshipRoleSuggestions,
  RelationshipRoleSuggestionsState,
} from "../api/use-relationship-role-suggestions";
import type { RelationshipPickerStatusMessage } from "./relationship-picker-status";

import { useRelationshipRoleSuggestions } from "../api/use-relationship-role-suggestions";
import { isPopupOpenKey, keepCaretKeysInInput } from "./relationship-command-keys";
import {
  keepPickerInputFocus,
  RelationshipPickerRetryItem,
  RelationshipPickerStatus,
} from "./relationship-picker-status";
import { useCommandInputExpanded } from "./use-command-input-expanded";

const ROLE_COMBOBOX = {
  freeValueItem: "relationship-role-free-value",
} as const;

type RelationshipRoleSuggestionComboboxProps = {
  describedBy?: string;
  invalid: boolean;
  label: string;
  onBlur: () => void;
  onChange: (role: string) => void;
  ref?: Ref<HTMLInputElement>;
  value: string;
};

export function RelationshipRoleSuggestionCombobox({
  describedBy,
  invalid,
  label,
  onBlur,
  onChange,
  ref,
  value,
}: RelationshipRoleSuggestionComboboxProps) {
  const t = useTranslations("relationships.editor.labels");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const suggestions = useRelationshipRoleSuggestions({ enabled: open, search: value });
  const isSearchHint = suggestions.state.kind === "hint";
  const isPopupOpen = open && !isSearchHint;
  const searchHintId = useId();
  const inputDescribedBy = isSearchHint
    ? [describedBy, searchHintId].filter((part) => part !== undefined).join(" ")
    : describedBy;
  useCommandInputExpanded({ anchorRef, expanded: isPopupOpen });

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    keepCaretKeysInInput(event);
    if (!open && isPopupOpenKey(event.key)) setOpen(true);
  }

  function pick(role: string) {
    onChange(role);
    setOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <CommandPrimitive label={label} shouldFilter={false}>
        <Popover onOpenChange={setOpen} open={isPopupOpen}>
          <PopoverAnchor asChild>
            <div ref={anchorRef}>
              <CommandPrimitive.Input
                aria-describedby={inputDescribedBy}
                aria-invalid={invalid}
                autoComplete="off"
                className={cn(
                  "h-11 w-full min-w-0 rounded-lg border border-input bg-field px-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 md:text-sm",
                  invalid &&
                    "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
                )}
                maxLength={CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS.labelMax}
                onBlur={onBlur}
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                onKeyDown={handleInputKeyDown}
                onValueChange={(next) => {
                  onChange(next);
                  setOpen(true);
                }}
                placeholder={t("placeholder")}
                ref={ref}
                value={value}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) p-1"
            onInteractOutside={(event) => {
              const target = event.detail.originalEvent.target;
              if (target instanceof Node && anchorRef.current?.contains(target)) {
                event.preventDefault();
              }
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
            sideOffset={6}
          >
            <RelationshipPickerStatus
              loadMoreErrorText={t("suggestions.loadMoreError")}
              message={toStatusMessage({
                isBrowsing: value.trim() === "",
                state: suggestions.state,
                t,
              })}
              pagination={suggestions}
            />
            <RoleSuggestionResults key={value.trim()} onPick={pick} suggestions={suggestions} />
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
      {isSearchHint ? (
        <p className="text-xs text-muted-foreground" id={searchHintId}>
          {t("suggestions.searchHint")}
        </p>
      ) : null}
    </div>
  );
}

function RoleSuggestionResults({
  onPick,
  suggestions,
}: {
  onPick: (role: string) => void;
  suggestions: RelationshipRoleSuggestions;
}) {
  const t = useTranslations("relationships.editor.labels.suggestions");
  const { freeValue, state } = suggestions;
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: suggestions.hasNextPage,
    isFetchingNextPage: suggestions.isFetchingNextPage,
    itemCount: state.kind === "results" ? state.items.length : 0,
    onLoadMore: suggestions.fetchNextPage,
  });

  return (
    <CommandList
      aria-busy={state.kind === "loading" || suggestions.isFetchingNextPage}
      label={t("list")}
      onScroll={onScroll}
      ref={scrollRef}
    >
      {freeValue === null ? null : (
        <CommandItem
          className="min-h-11 cursor-pointer sm:min-h-0"
          onMouseDown={keepPickerInputFocus}
          onSelect={() => onPick(freeValue)}
          value={ROLE_COMBOBOX.freeValueItem}
        >
          <TruncatedText className="flex-1" text={t("useTyped", { role: freeValue })} />
        </CommandItem>
      )}
      {state.kind === "results"
        ? state.items.map((item) => (
            <CommandItem
              className="min-h-11 cursor-pointer sm:min-h-0"
              disabled={state.isStale}
              key={item.id}
              onMouseDown={keepPickerInputFocus}
              onSelect={() => onPick(item.label)}
              value={item.id}
            >
              <TruncatedText className="flex-1" text={item.label} />
            </CommandItem>
          ))
        : null}
      {state.kind === "error" || suggestions.isLoadMoreError ? (
        <RelationshipPickerRetryItem onRetry={suggestions.retry} />
      ) : null}
    </CommandList>
  );
}

function toStatusMessage({
  isBrowsing,
  state,
  t,
}: {
  isBrowsing: boolean;
  state: RelationshipRoleSuggestionsState;
  t: ReturnType<typeof useTranslations<"relationships.editor.labels">>;
}): Nullable<RelationshipPickerStatusMessage> {
  switch (state.kind) {
    case "empty":
      return {
        text: isBrowsing ? t("suggestions.emptyBrowse") : t("suggestions.emptySearch"),
        tone: "info",
      };
    case "error":
      return { text: t("suggestions.error"), tone: "error" };
    case "hint":
    case "results":
      return null;
    case "loading":
      return { text: t("suggestions.loading"), tone: "progress" };
    default:
      return assertNever(state);
  }
}
