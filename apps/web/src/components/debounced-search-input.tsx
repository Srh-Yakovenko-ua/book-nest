"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

type DebouncedSearchInputProps = {
  clearLabel: string;
  inputRef?: RefObject<Nullable<HTMLInputElement>>;
  isCommittable?: (value: string) => boolean;
  label: string;
  maxLength?: number;
  onClear: () => void;
  onSearch: (value: string) => void;
  placeholder: string;
  value: string;
};

export function DebouncedSearchInput({
  clearLabel,
  inputRef,
  isCommittable = defaultIsCommittable,
  label,
  maxLength,
  onClear,
  onSearch,
  placeholder,
  value,
}: DebouncedSearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [lastSent, setLastSent] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ownInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = inputRef ?? ownInputRef;

  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== lastSent) {
      setDraft(value);
      setLastSent(value);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), [value]);

  function commit(next: string) {
    const normalized = normalizeSearchQuery(next);
    const query = isCommittable(normalized) ? normalized : "";
    if (query === lastSent) return;
    setLastSent(query);
    onSearch(query);
  }

  function handleChange(next: string) {
    setDraft(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    clearTimeout(timerRef.current);
    setLastSent("");
    setDraft("");
    searchInputRef.current?.focus();
    onClear();
  }

  return (
    <div className="relative flex items-center">
      <UiIcon
        aria-hidden
        className="pointer-events-none absolute left-3 text-muted-foreground"
        name="search"
        size={18}
      />
      <input
        aria-label={label}
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        enterKeyHint="search"
        maxLength={maxLength}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        ref={searchInputRef}
        type="text"
        value={draft}
      />
      {draft.length > 0 ? (
        <button
          aria-label={clearLabel}
          className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={handleClear}
          type="button"
        >
          <UiIcon name="x" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function defaultIsCommittable(value: string): boolean {
  return value.length === 0 || value.length >= SEARCH_MIN_LENGTH;
}
