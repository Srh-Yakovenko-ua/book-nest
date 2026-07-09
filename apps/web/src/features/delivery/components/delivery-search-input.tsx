"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

type DeliverySearchInputProps = {
  onClear: () => void;
  onSearch: (value: string) => void;
  value: string;
};

export function DeliverySearchInput({ onClear, onSearch, value }: DeliverySearchInputProps) {
  const t = useTranslations("delivery.search");
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [lastSent, setLastSent] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== lastSent) {
      setDraft(value);
      setLastSent(value);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), [value]);

  function commit(next: string) {
    const normalized = next.trim().replace(/\s+/g, " ");
    if (normalized === lastSent) return;
    if (normalized.length !== 0 && normalized.length < SEARCH_MIN_LENGTH) return;
    setLastSent(normalized);
    onSearch(normalized);
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
        aria-label={t("label")}
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
        )}
        enterKeyHint="search"
        onChange={(event) => handleChange(event.target.value)}
        placeholder={t("placeholder")}
        type="text"
        value={draft}
      />
      {draft.length > 0 ? (
        <button
          aria-label={t("clear")}
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
