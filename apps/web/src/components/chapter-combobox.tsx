"use client";

import type { BookChapterUsageView } from "@app/shared";
import type { KeyboardEvent } from "react";

import { Command as CommandPrimitive } from "cmdk";
import { useRef, useState } from "react";

import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

type ChapterComboboxProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  maxLength: number;
  onChange: (value: string) => void;
  options: BookChapterUsageView[];
  placeholder: string;
  value: string;
};

const SUGGESTION_KEYS = {
  caret: new Set(["End", "Home"]),
  highlight: new Set(["ArrowDown", "ArrowUp"]),
  pick: "Enter",
} as const;

export function ChapterCombobox({
  describedBy,
  id,
  invalid,
  maxLength,
  onChange,
  options,
  placeholder,
  value,
}: ChapterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlightArmed, setHighlightArmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasOptions = options.length > 0;
  const suggestions = matchingChapters(options, value);
  const suggestionsOpen = open && suggestions.length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (SUGGESTION_KEYS.caret.has(event.key)) {
      event.stopPropagation();
      return;
    }
    if (SUGGESTION_KEYS.highlight.has(event.key)) {
      if (!suggestionsOpen) {
        event.stopPropagation();
        return;
      }
      setHighlightArmed(true);
      return;
    }
    if (event.key !== SUGGESTION_KEYS.pick) return;
    if (!suggestionsOpen || !highlightArmed) event.stopPropagation();
  }

  function typeChapter(chapter: string) {
    onChange(chapter);
    setHighlightArmed(false);
    setOpen(true);
  }

  function pickChapter(chapter: string) {
    onChange(chapter);
    setHighlightArmed(false);
    setOpen(false);
  }

  function toggleSuggestions(next: boolean) {
    setOpen(next);
    if (!next) setHighlightArmed(false);
  }

  return (
    <CommandPrimitive shouldFilter={false}>
      <Popover onOpenChange={toggleSuggestions} open={suggestionsOpen}>
        <PopoverAnchor asChild>
          <Input
            aria-autocomplete={hasOptions ? "list" : undefined}
            aria-describedby={describedBy}
            aria-expanded={hasOptions ? suggestionsOpen : undefined}
            aria-invalid={invalid}
            autoComplete="off"
            className="h-10"
            id={id}
            maxLength={maxLength}
            onChange={(event) => typeChapter(event.target.value)}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            ref={inputRef}
            role={hasOptions ? "combobox" : undefined}
            value={value}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-1"
          onInteractOutside={(event) => {
            if (event.detail.originalEvent.target === inputRef.current) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={6}
        >
          <CommandList>
            <CommandGroup>
              {suggestions.map((option) => (
                <CommandItem
                  className="cursor-pointer"
                  key={option.chapter}
                  onSelect={() => pickChapter(option.chapter)}
                  value={option.chapter}
                >
                  <span className="min-w-0 flex-1 truncate">{option.chapter}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}

function matchingChapters(options: BookChapterUsageView[], value: string): BookChapterUsageView[] {
  const query = value.trim().toLowerCase();
  if (query.length === 0) return options;
  return options.filter((option) => option.chapter.toLowerCase().includes(query));
}
