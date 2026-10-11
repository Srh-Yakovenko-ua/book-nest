"use client";

import type { Nullable, SpeciesOptionView, ValueOf } from "@app/shared";
import type { KeyboardEvent, RefCallback } from "react";

import { SPECIES_SEARCH } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { SpeciesSelection } from "../model/species-selection";
import type { SpeciesCreateOffer, SpeciesPickerNotice } from "../model/use-species-picker-model";

import { selectionFromOption } from "../model/species-selection";
import { useSpeciesPickerModel } from "../model/use-species-picker-model";
import { useSpeciesPickerNoticeText } from "../model/use-species-picker-notice-text";
import { speciesPickerEntryId, SpeciesPickerListbox } from "./species-picker-listbox";

type SpeciesPickerEntry =
  | { id: string; kind: "create"; offer: SpeciesCreateOffer }
  | { id: string; kind: "option"; option: SpeciesOptionView };

type SpeciesPickerProps = {
  excludeId?: string;
  inputId: string;
  label: string;
  onBlur?: () => void;
  onChange: (selection: Nullable<SpeciesSelection>) => void;
  placeholder: string;
  ref?: RefCallback<HTMLInputElement>;
  value: Nullable<SpeciesSelection>;
};

const HIGHLIGHT_STEP = { ArrowDown: 1, ArrowUp: -1 } as const;

const CREATE_ENTRY_KEY = "create";

export function SpeciesPicker({
  excludeId,
  inputId,
  label,
  onBlur,
  onChange,
  placeholder,
  ref,
  value,
}: SpeciesPickerProps) {
  const t = useTranslations("species.picker");
  const listboxId = useId();
  const anchorRef = useRef<Nullable<HTMLDivElement>>(null);
  const inputRef = useRef<Nullable<HTMLInputElement>>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState<Nullable<string>>(null);
  const [highlightedId, setHighlightedId] = useState<Nullable<string>>(null);

  const typed = search ?? "";
  const model = useSpeciesPickerModel({ excludeId, open, typed });
  const isCreating = model.createSpecies.isPending;

  const optionEntries = model.sections
    .flatMap((section) => (section.kind === "group" ? section.group.options : section.options))
    .map((option): SpeciesPickerEntry => ({
      id: speciesPickerEntryId(listboxId, option.id),
      kind: "option",
      option,
    }));
  const createEntry: Nullable<SpeciesPickerEntry> =
    model.create === null
      ? null
      : {
          id: speciesPickerEntryId(listboxId, CREATE_ENTRY_KEY),
          kind: "create",
          offer: model.create,
        };
  const entries = createEntry === null ? optionEntries : [...optionEntries, createEntry];
  const firstMatch = typed.trim().length < SPECIES_SEARCH.minQueryLength ? undefined : entries[0];
  const defaultEntry =
    search === null ? entries.find((entry) => isSelected(entry, value)) : firstMatch;
  const activeEntry = entries.find((entry) => entry.id === highlightedId) ?? defaultEntry;
  const showClear = value !== null || typed.length > 0;
  const retriesOnEnter = activeEntry === undefined && model.notice === "loadFailed";

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) return;
    setSearch(null);
    setHighlightedId(null);
    if (!isCreating) model.createSpecies.reset();
  }

  function commit(selection: Nullable<SpeciesSelection>) {
    onChange(selection);
    changeOpen(false);
    inputRef.current?.focus();
  }

  function activate(entry: SpeciesPickerEntry) {
    if (entry.kind === "option") {
      commit(selectionFromOption(entry.option));
      return;
    }
    if (isCreating) return;
    model.createSpecies.mutate(
      { name: entry.offer.name },
      { onSuccess: (created) => commit(selectionFromOption(created)) },
    );
  }

  function entryAfterActive(step: ValueOf<typeof HIGHLIGHT_STEP>) {
    if (activeEntry === undefined) return step > 0 ? entries[0] : entries.at(-1);
    return entries[entries.indexOf(activeEntry) + step];
  }

  function activateOnEnter() {
    if (activeEntry !== undefined) {
      activate(activeEntry);
      return;
    }
    if (retriesOnEnter) model.retry();
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
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      changeOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open) activateOnEnter();
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
            aria-expanded={open}
            autoComplete="off"
            autoCorrect="off"
            className={cn(
              "h-10 w-full min-w-0 truncate rounded-lg border border-input bg-field pl-2.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
              showClear ? "pr-16" : "pr-8",
            )}
            id={inputId}
            maxLength={SPECIES_SEARCH.nameMax}
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
            placeholder={placeholder}
            ref={(element) => {
              inputRef.current = element;
              ref?.(element);
            }}
            role="combobox"
            spellCheck={false}
            type="text"
            value={search ?? value?.label ?? ""}
          />
          {showClear ? (
            <button
              aria-label={t("clear")}
              className="absolute top-1/2 right-8 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => commit(null)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <UiIcon name="x" size={14} />
            </button>
          ) : null}
          <UiIcon
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            name="chevron-down"
            size={16}
          />
          <span aria-live="polite" className="sr-only" role="status">
            {open ? (
              <PickerAnnouncement
                notice={model.notice}
                optionCount={optionEntries.length}
                retriesOnEnter={retriesOnEnter}
              />
            ) : null}
          </span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] min-w-64 p-1"
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
        <SpeciesPickerListbox
          activeId={activeEntry?.id}
          create={model.create}
          createId={speciesPickerEntryId(listboxId, CREATE_ENTRY_KEY)}
          isCreating={isCreating}
          label={label}
          listboxId={listboxId}
          notice={model.notice}
          onCreate={() => {
            if (createEntry !== null) activate(createEntry);
          }}
          onHighlight={setHighlightedId}
          onPick={(option) => commit(selectionFromOption(option))}
          onRetry={model.retry}
          sections={model.sections}
          selectedId={value?.id ?? null}
        />
      </PopoverContent>
    </Popover>
  );
}

function isSelected(entry: SpeciesPickerEntry, value: Nullable<SpeciesSelection>): boolean {
  return entry.kind === "option" && entry.option.id === value?.id;
}

function PickerAnnouncement({
  notice,
  optionCount,
  retriesOnEnter,
}: {
  notice: Nullable<SpeciesPickerNotice>;
  optionCount: number;
  retriesOnEnter: boolean;
}) {
  const t = useTranslations("species.picker");
  const noticeText = useSpeciesPickerNoticeText();

  return [
    notice === null ? null : noticeText(notice),
    optionCount === 0 ? null : t("resultsCount", { count: optionCount }),
    retriesOnEnter ? t("retryOnEnter") : null,
  ]
    .filter((part) => part !== null)
    .join(" ");
}
