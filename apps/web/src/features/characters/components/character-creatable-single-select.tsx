"use client";

import type { KeyboardEvent, RefCallback } from "react";

import {
  type CharacterCustomLabelUsageView,
  normalizeName,
  type Nullable,
  type ValueOf,
} from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CharacterCreatableSingleSelectProps<Option extends string, Sentinel extends Option> = {
  clearTo: Exclude<Option, Sentinel>;
  customText: string;
  describedBy: string | undefined;
  invalid: boolean;
  label: string;
  maxLength: number;
  onBlur?: () => void;
  onChange: (choice: CreatableChoice<Option, Sentinel>) => void;
  optionLabel: (option: Option) => string;
  options: readonly Option[];
  ref?: RefCallback<HTMLInputElement>;
  sentinel: Sentinel;
  suggestions?: CustomSuggestions;
  value: Option;
};

type CreatableChoice<Option extends string, Sentinel extends Option> =
  { customText: ""; option: Exclude<Option, Sentinel> } | { customText: string; option: Sentinel };

type CustomSuggestions = {
  heading: string;
  labels: readonly CharacterCustomLabelUsageView[];
};

type EntryDisplay = ({ count: number; kind: "suggestion" } | { kind: "create" | "standard" }) & {
  id: string;
  text: string;
};

type ListEntry<Option extends string, Sentinel extends Option> = EntryDisplay & {
  choice: CreatableChoice<Option, Sentinel>;
};

const HIGHLIGHT_STEP = { ArrowDown: 1, ArrowUp: -1 } as const;

export function CharacterCreatableSingleSelect<Option extends string, Sentinel extends Option>({
  clearTo,
  customText,
  describedBy,
  invalid,
  label,
  maxLength,
  onBlur,
  onChange,
  optionLabel,
  options,
  ref,
  sentinel,
  suggestions,
  value,
}: CharacterCreatableSingleSelectProps<Option, Sentinel>) {
  const t = useTranslations("characters.creatableSelect");
  const tCommon = useTranslations("common");
  const listboxId = useId();
  const suggestionsHeadingId = `${listboxId}-suggestions-heading`;
  const anchorRef = useRef<Nullable<HTMLDivElement>>(null);
  const inputRef = useRef<Nullable<HTMLInputElement>>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState<Nullable<string>>(null);
  const [highlightedId, setHighlightedId] = useState<Nullable<string>>(null);

  const typedText = search ?? "";
  const query = normalizeName(typedText);
  const customName = typedText.trim();
  const committedCustomText = customText.trim();
  const committedLabel =
    value === sentinel && committedCustomText.length > 0 ? committedCustomText : optionLabel(value);
  const standardEntries = options
    .filter(isStandard)
    .map((option, index): ListEntry<Option, Sentinel> => ({
      choice: { customText: "", option },
      id: `${listboxId}-option-${index}`,
      kind: "standard",
      text: optionLabel(option),
    }));
  const standardNames = new Set(standardEntries.map(({ text }) => normalizeName(text)));
  const suggestionEntries = (suggestions?.labels ?? [])
    .filter(({ label }) => !standardNames.has(normalizeName(label)))
    .map(({ count, label }, index): ListEntry<Option, Sentinel> => ({
      choice: { customText: label, option: sentinel },
      count,
      id: `${listboxId}-suggestion-${index}`,
      kind: "suggestion",
      text: label,
    }));
  const createEntry: ListEntry<Option, Sentinel> = {
    choice: { customText: customName, option: sentinel },
    id: `${listboxId}-create`,
    kind: "create",
    text: t("create", { name: customName }),
  };
  const matchingStandard = standardEntries.filter(matchesQuery);
  const matchingSuggestions = suggestionEntries.filter(matchesQuery);
  const exactEntry = [...matchingStandard, ...matchingSuggestions].find(
    ({ text }) => normalizeName(text) === query,
  );
  const canCreate = customName.length > 0 && exactEntry === undefined;
  const entries = [
    ...matchingStandard,
    ...matchingSuggestions,
    ...(canCreate ? [createEntry] : []),
  ];
  const defaultEntry = search === null ? entries.find(isCommitted) : (exactEntry ?? entries[0]);
  const activeEntry = entries.find((entry) => entry.id === highlightedId) ?? defaultEntry;
  const showClear = value !== clearTo || typedText.length > 0;

  function isStandard(option: Option): option is Exclude<Option, Sentinel> {
    return option !== sentinel;
  }

  function matchesQuery({ text }: ListEntry<Option, Sentinel>) {
    return normalizeName(text).includes(query);
  }

  function isCommitted(entry: ListEntry<Option, Sentinel>) {
    if (entry.kind === "create") return false;
    if (entry.kind === "standard") return entry.choice.option === value;
    return value === sentinel && normalizeName(entry.text) === normalizeName(committedCustomText);
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) return;
    setSearch(null);
    setHighlightedId(null);
  }

  function commit(choice: CreatableChoice<Option, Sentinel>) {
    onChange(choice);
    changeOpen(false);
    inputRef.current?.focus();
  }

  function entryAfterActive(step: ValueOf<typeof HIGHLIGHT_STEP>) {
    if (activeEntry === undefined) return step > 0 ? entries[0] : entries.at(-1);
    return entries[entries.indexOf(activeEntry) + step];
  }

  function moveHighlight(step: ValueOf<typeof HIGHLIGHT_STEP>) {
    const next = entryAfterActive(step);
    if (next === undefined) return;
    setHighlightedId(next.id);
    document.getElementById(next.id)?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Tab") {
      changeOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && activeEntry !== undefined) commit(activeEntry.choice);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (open) moveHighlight(HIGHLIGHT_STEP[event.key]);
    else setOpen(true);
  }

  return (
    <Popover onOpenChange={changeOpen} open={open}>
      <PopoverAnchor asChild>
        <div className="relative" ref={anchorRef}>
          <input
            aria-activedescendant={open ? activeEntry?.id : undefined}
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-describedby={describedBy}
            aria-expanded={open}
            aria-invalid={invalid}
            aria-label={label}
            autoComplete="off"
            autoCorrect="off"
            className={cn(
              "h-10 w-full min-w-0 truncate rounded-lg border border-input bg-field pl-2.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              showClear ? "pr-14" : "pr-8",
            )}
            maxLength={maxLength}
            onBlur={onBlur}
            onChange={(event) => {
              setSearch(event.target.value);
              setHighlightedId(null);
              setOpen(true);
            }}
            onClick={(event) => {
              if (search === null) event.currentTarget.select();
              setOpen(true);
            }}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            ref={(element) => {
              inputRef.current = element;
              ref?.(element);
            }}
            role="combobox"
            spellCheck={false}
            type="text"
            value={search ?? committedLabel}
          />
          {showClear ? (
            <button
              aria-label={tCommon("clear")}
              className="absolute top-1/2 right-8 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => commit({ customText: "", option: clearTo })}
              onMouseDown={(event) => event.preventDefault()}
              tabIndex={-1}
              type="button"
            >
              <UiIcon name="x" size={14} />
            </button>
          ) : null}
          <UiIcon
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            name="chevron-down"
            size={16}
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
        onMouseDown={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => event.preventDefault()}
        role="presentation"
        sideOffset={6}
      >
        <div
          aria-label={label}
          className="no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto"
          id={listboxId}
          role="listbox"
          tabIndex={-1}
        >
          {matchingStandard.map((entry) => (
            <CreatableOption
              active={entry === activeEntry}
              committed={isCommitted(entry)}
              entry={entry}
              key={entry.id}
              onHighlight={() => setHighlightedId(entry.id)}
              onPick={() => commit(entry.choice)}
            />
          ))}
          {suggestions === undefined || matchingSuggestions.length === 0 ? null : (
            <div aria-labelledby={suggestionsHeadingId} role="group">
              <div
                aria-hidden
                className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
                id={suggestionsHeadingId}
              >
                {suggestions.heading}
              </div>
              {matchingSuggestions.map((entry) => (
                <CreatableOption
                  active={entry === activeEntry}
                  committed={isCommitted(entry)}
                  entry={entry}
                  key={entry.id}
                  onHighlight={() => setHighlightedId(entry.id)}
                  onPick={() => commit(entry.choice)}
                />
              ))}
            </div>
          )}
          {canCreate ? (
            <CreatableOption
              active={createEntry === activeEntry}
              committed={isCommitted(createEntry)}
              entry={createEntry}
              onHighlight={() => setHighlightedId(createEntry.id)}
              onPick={() => commit(createEntry.choice)}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CreatableOption({
  active,
  committed,
  entry,
  onHighlight,
  onPick,
}: {
  active: boolean;
  committed: boolean;
  entry: EntryDisplay;
  onHighlight: () => void;
  onPick: () => void;
}) {
  const t = useTranslations("characters.creatableSelect");

  return (
    <button
      aria-selected={active}
      className="relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:ring-1 aria-selected:ring-ring"
      id={entry.id}
      onClick={onPick}
      onPointerMove={onHighlight}
      role="option"
      tabIndex={-1}
      type="button"
    >
      {entry.kind === "create" ? <UiIcon className="text-primary" name="plus" size={16} /> : null}
      <span className="min-w-0 flex-1 truncate">{entry.text}</span>
      {entry.kind === "suggestion" ? (
        <>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {entry.count}
          </span>
          <span className="sr-only">{t("usageCount", { count: entry.count })}</span>
        </>
      ) : null}
      {committed ? <UiIcon className="shrink-0" name="check" size={16} /> : null}
    </button>
  );
}
