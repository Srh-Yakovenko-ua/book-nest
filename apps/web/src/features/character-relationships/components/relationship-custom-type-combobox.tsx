"use client";

import type { Nullable, RelationshipDirectionality } from "@app/shared";
import type { KeyboardEvent, Ref } from "react";

import {
  CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS,
  collapseSpaces,
  normalizeName,
} from "@app/shared";
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
  RelationshipCustomTypeSuggestions,
  RelationshipCustomTypeSuggestionsState,
} from "../api/use-relationship-custom-type-suggestions";
import type { RelationshipCustomTypeChoice } from "../model/relationship-create-type-actions";
import type { RelationshipPickerStatusMessage } from "./relationship-picker-status";

import { useRelationshipCustomTypeSuggestions } from "../api/use-relationship-custom-type-suggestions";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { isPopupOpenKey, keepCaretKeysInInput } from "./relationship-command-keys";
import {
  keepPickerInputFocus,
  RelationshipPickerRetryItem,
  RelationshipPickerStatus,
} from "./relationship-picker-status";
import { useCommandInputExpanded } from "./use-command-input-expanded";

const CUSTOM_TYPE_COMBOBOX = {
  freeValueItem: "relationship-custom-type-free-value",
} as const;

type CustomTypePick = (choice: RelationshipCustomTypeChoice) => void;

type RelationshipCustomTypeComboboxProps = {
  describedBy?: string;
  directionality?: RelationshipDirectionality;
  invalid: boolean;
  label: string;
  onBlur: () => void;
  onChange: (name: string) => void;
  onCommit?: (name: string) => void;
  onPick: CustomTypePick;
  ref?: Ref<HTMLInputElement>;
  value: string;
};

export function RelationshipCustomTypeCombobox({
  describedBy,
  directionality,
  invalid,
  label,
  onBlur,
  onChange,
  onCommit,
  onPick,
  ref,
  value,
}: RelationshipCustomTypeComboboxProps) {
  const t = useTranslations("relationships.editor");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const suggestions = useRelationshipCustomTypeSuggestions({
    directionality: directionality ?? null,
    enabled: open,
    search: value,
  });
  const isSearchHint = suggestions.state.kind === "hint";
  const isPopupOpen = open && !isSearchHint;
  const searchHintId = useId();
  const inputDescribedBy = isSearchHint
    ? [describedBy, searchHintId].filter((part) => part !== undefined).join(" ")
    : describedBy;
  const typedName = collapseSpaces(value);
  useCommandInputExpanded({ anchorRef, expanded: isPopupOpen });

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    keepCaretKeysInInput(event);
    if (!open && isPopupOpenKey(event.key)) setOpen(true);
  }

  function pick(choice: RelationshipCustomTypeChoice) {
    onPick(choice);
    onCommit?.(choice.name);
    setOpen(false);
  }

  function chooseTypedName() {
    onChange(typedName);
    onCommit?.(typedName);
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
                aria-required
                autoComplete="off"
                className={cn(
                  "h-11 w-full min-w-0 rounded-lg border border-input bg-field px-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10 md:text-sm",
                  invalid &&
                    "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
                )}
                data-relationship-autofocus=""
                maxLength={CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS.nameMax}
                onBlur={() => {
                  onBlur();
                  onCommit?.(value);
                }}
                onClick={() => setOpen(true)}
                onKeyDown={handleInputKeyDown}
                onValueChange={(next) => {
                  onChange(next);
                  setOpen(true);
                }}
                placeholder={t("type.customPlaceholder")}
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
              loadMoreErrorText={t("customType.loadMoreError")}
              message={toStatusMessage({
                isBrowsing: typedName === "",
                state: suggestions.state,
                t,
              })}
              pagination={suggestions}
            />
            <SuggestionResults
              freeName={toFreeName({ state: suggestions.state, typedName })}
              key={value.trim()}
              onPick={pick}
              onUseTyped={chooseTypedName}
              suggestions={suggestions}
            />
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
      {isSearchHint ? (
        <p className="text-xs text-muted-foreground" id={searchHintId}>
          {t("customType.searchHint")}
        </p>
      ) : null}
    </div>
  );
}

function SuggestionResults({
  freeName,
  onPick,
  onUseTyped,
  suggestions,
}: {
  freeName: Nullable<string>;
  onPick: CustomTypePick;
  onUseTyped: () => void;
  suggestions: RelationshipCustomTypeSuggestions;
}) {
  const t = useTranslations("relationships.editor.customType");
  const labels = useRelationshipLabels();
  const { state } = suggestions;
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: suggestions.hasNextPage,
    isFetchingNextPage: suggestions.isFetchingNextPage,
    itemCount: state.kind === "results" ? state.items.length : 0,
    onLoadMore: suggestions.fetchNextPage,
  });

  return (
    <CommandList
      aria-busy={state.kind === "loading" || suggestions.isFetchingNextPage}
      label={t("suggestions")}
      onScroll={onScroll}
      ref={scrollRef}
    >
      {freeName === null ? null : (
        <CommandItem
          className="min-h-11 cursor-pointer sm:min-h-0"
          onMouseDown={keepPickerInputFocus}
          onSelect={onUseTyped}
          value={CUSTOM_TYPE_COMBOBOX.freeValueItem}
        >
          <TruncatedText className="flex-1" text={t("useTyped", { name: freeName })} />
        </CommandItem>
      )}
      {state.kind === "results"
        ? state.items.map((item) => (
            <CommandItem
              className="min-h-11 cursor-pointer sm:min-h-0"
              disabled={state.isStale}
              key={item.id}
              onMouseDown={keepPickerInputFocus}
              onSelect={() => onPick({ directionality: item.directionality, name: item.name })}
              value={item.id}
            >
              <TruncatedText className="flex-1" text={item.name} />
              <span className="shrink-0 text-xs text-muted-foreground">
                {labels.directionality(item.directionality)}
              </span>
            </CommandItem>
          ))
        : null}
      {state.kind === "error" || suggestions.isLoadMoreError ? (
        <RelationshipPickerRetryItem onRetry={suggestions.retry} />
      ) : null}
    </CommandList>
  );
}

function toFreeName({
  state,
  typedName,
}: {
  state: RelationshipCustomTypeSuggestionsState;
  typedName: string;
}): Nullable<string> {
  if (typedName === "") return null;
  const hasExactMatch =
    state.kind === "results" &&
    !state.isStale &&
    state.items.some((item) => normalizeName(item.name) === normalizeName(typedName));
  return hasExactMatch ? null : typedName;
}

function toStatusMessage({
  isBrowsing,
  state,
  t,
}: {
  isBrowsing: boolean;
  state: RelationshipCustomTypeSuggestionsState;
  t: ReturnType<typeof useTranslations<"relationships.editor">>;
}): Nullable<RelationshipPickerStatusMessage> {
  switch (state.kind) {
    case "empty":
      return {
        text: isBrowsing ? t("customType.emptyBrowse") : t("customType.emptySearch"),
        tone: "info",
      };
    case "error":
      return { text: t("customType.error"), tone: "error" };
    case "hint":
    case "results":
      return null;
    case "loading":
      return { text: t("customType.loading"), tone: "progress" };
    default:
      return assertNever(state);
  }
}
