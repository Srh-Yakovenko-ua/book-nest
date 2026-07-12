"use client";

import type { MouseEvent } from "react";

import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const YEARS_PER_PAGE = 12;

const triggerClassName =
  "flex h-10 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-field px-3 text-sm whitespace-nowrap transition-colors outline-none select-none hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const clearClassName =
  "absolute top-1/2 right-2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

type YearPickerProps = {
  ariaLabel?: string;
  clearLabel: string;
  id: string;
  invalid?: boolean;
  max: number;
  min: number;
  nextLabel: string;
  onChange: (year: null | number) => void;
  placeholder?: string;
  prevLabel: string;
  value: null | number;
};

export function YearPicker({
  ariaLabel,
  clearLabel,
  id,
  invalid,
  max,
  min,
  nextLabel,
  onChange,
  placeholder,
  prevLabel,
  value,
}: YearPickerProps) {
  const [open, setOpen] = useState(false);
  const [pageStart, setPageStart] = useState(() => alignPageStart(value ?? max, max));

  const years = Array.from({ length: YEARS_PER_PAGE }, (_, index) => pageStart + index);
  const canGoPrev = pageStart > min;
  const canGoNext = pageStart + YEARS_PER_PAGE - 1 < max;
  const rangeLabel = `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`;

  function handleOpenChange(next: boolean) {
    if (next) setPageStart(alignPageStart(value ?? max, max));
    setOpen(next);
  }

  function handleClear(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onChange(null);
  }

  function handleSelect(year: number) {
    onChange(year);
    setOpen(false);
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <div className="relative w-full">
        <PopoverTrigger
          aria-invalid={invalid ? true : undefined}
          aria-label={ariaLabel}
          className={cn(triggerClassName, value !== null && "pr-9")}
          id={id}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <UiIcon className="shrink-0 text-muted-foreground" name="calendar" size={16} />
            <span className={cn("truncate", value === null && "text-muted-foreground")}>
              {value === null ? placeholder : value}
            </span>
          </span>
        </PopoverTrigger>
        {value !== null ? (
          <button
            aria-label={clearLabel}
            className={clearClassName}
            onClick={handleClear}
            type="button"
          >
            <UiIcon name="x" size={14} />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-64">
        <div className="flex items-center justify-between gap-1">
          <Button
            aria-label={prevLabel}
            disabled={!canGoPrev}
            onClick={() => setPageStart((start) => start - YEARS_PER_PAGE)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="chevron-left" size={16} />
          </Button>
          <span className="text-sm font-medium tabular-nums">{rangeLabel}</span>
          <Button
            aria-label={nextLabel}
            disabled={!canGoNext}
            onClick={() => setPageStart((start) => start + YEARS_PER_PAGE)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="chevron-right" size={16} />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {years.map((year) => (
            <Button
              className="w-full tabular-nums"
              disabled={year < min || year > max}
              key={year}
              onClick={() => handleSelect(year)}
              type="button"
              variant={year === value ? "default" : "ghost"}
            >
              {year}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function alignPageStart(year: number, max: number): number {
  const bucket = Math.floor((max - Math.min(year, max)) / YEARS_PER_PAGE);
  return max - bucket * YEARS_PER_PAGE - (YEARS_PER_PAGE - 1);
}
