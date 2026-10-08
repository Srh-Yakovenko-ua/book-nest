"use client";

import type { KeyboardEvent, RefCallback } from "react";

import { normalizeName, type Nullable, type ValueOf } from "@app/shared";
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
  value: Option;
};

type CreatableChoice<Option extends string, Sentinel extends Option> =
  { customText: ""; option: Exclude<Option, Sentinel> } | { customText: string; option: Sentinel };

type ListEntry<Option extends string, Sentinel extends Option> = {
  choice: CreatableChoice<Option, Sentinel>;
  id: string;
  text: string;
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
  value,
}: CharacterCreatableSingleSelectProps<Option, Sentinel>) {
  const t = useTranslations("characters.creatableSelect");
  const tCommon = useTranslations("common");
  const listboxId = useId();
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
      text: optionLabel(option),
    }));
  const createEntry: ListEntry<Option, Sentinel> = {
    choice: { customText: customName, option: sentinel },
    id: `${listboxId}-create`,
    text: t("create", { name: customName }),
  };
  const matchingEntries = standardEntries.filter(({ text }) => normalizeName(text).includes(query));
  const exactEntry = matchingEntries.find(({ text }) => normalizeName(text) === query);
  const canCreate = customName.length > 0 && exactEntry === undefined;
  const entries = canCreate ? [...matchingEntries, createEntry] : matchingEntries;
  const defaultEntry =
    search === null
      ? entries.find((entry) => entry.choice.option === value)
      : (exactEntry ?? entries[0]);
  const activeEntry = entries.find((entry) => entry.id === highlightedId) ?? defaultEntry;
  const showClear = value !== clearTo || typedText.length > 0;

  function isStandard(option: Option): option is Exclude<Option, Sentinel> {
    return option !== sentinel;
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
          {entries.map((entry) => (
            <button
              aria-selected={entry === activeEntry}
              className="relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:ring-1 aria-selected:ring-ring"
              id={entry.id}
              key={entry.id}
              onClick={() => commit(entry.choice)}
              onPointerMove={() => setHighlightedId(entry.id)}
              role="option"
              tabIndex={-1}
              type="button"
            >
              {entry === createEntry ? (
                <UiIcon className="text-primary" name="plus" size={16} />
              ) : null}
              <span className="min-w-0 truncate">{entry.text}</span>
              {entry !== createEntry && entry.choice.option === value ? (
                <UiIcon className="ml-auto" name="check" size={16} />
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
