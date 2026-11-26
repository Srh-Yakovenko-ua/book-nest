"use client";

import type { InterfaceLanguage } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useAutosaveField } from "../hooks/use-autosave-field";
import { currentTimezoneName } from "../model/current-timezone-names";
import { timezoneOption, timezoneOptions } from "../model/timezone-options";
import { rankTimezones } from "../model/timezone-search";
import { FieldSaveStatus } from "./field-save-status";

export function TimezoneRow({ timezone }: { timezone: string }) {
  const t = useTranslations("settings.regional.timezone");
  const language = useLocale();
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timezoneField = useAutosaveField({
    confirmed: currentTimezoneName(timezone),
    fromInput: (input) => input.timezone,
    toInput: (next) => ({ timezone: next }),
  });

  const labelId = `settings-timezone-label-${generatedId}`;
  const triggerId = `settings-timezone-${generatedId}`;
  const hintId = `settings-timezone-hint-${generatedId}`;
  const isSaving = timezoneField.status === "saving";
  const selected = timezoneOption({ language, now: new Date(), zone: timezoneField.value });

  function pick(value: string) {
    setOpen(false);
    timezoneField.save(value);
  }

  function retry() {
    triggerRef.current?.focus();
    timezoneField.retry();
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <Label htmlFor={triggerId} id={labelId}>
          {t("label")}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
          {t("hint")}
        </p>
      </div>
      <Popover
        onOpenChange={(next) => {
          if (next && isSaving) return;
          setOpen(next);
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button
            aria-describedby={hintId}
            aria-disabled={isSaving}
            aria-labelledby={`${labelId} ${triggerId}`}
            className="w-full justify-between font-normal aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:w-72"
            id={triggerId}
            ref={triggerRef}
            type="button"
            variant="outline"
          >
            <span className="truncate">{selected.label}</span>
            <UiIcon className="shrink-0 opacity-60" name="chevron-down" size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-labelledby={labelId}
          className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) p-0"
        >
          <TimezoneSearch language={language} onPick={pick} storedZone={timezoneField.value} />
        </PopoverContent>
      </Popover>
      <FieldSaveStatus
        className="basis-full"
        fieldLabelId={labelId}
        onRetry={retry}
        status={timezoneField.status}
      />
    </div>
  );
}

function TimezoneSearch({
  language,
  onPick,
  storedZone,
}: {
  language: InterfaceLanguage;
  onPick: (value: string) => void;
  storedZone: string;
}) {
  const t = useTranslations("settings.regional.timezone");
  const [options] = useState(() => timezoneOptions({ language, now: new Date(), storedZone }));
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState(storedZone);
  const results = rankTimezones({ options, query });
  const hasResults = results.length > 0;

  return (
    <Command
      label={t("search")}
      onValueChange={setActiveValue}
      shouldFilter={false}
      value={activeValue}
    >
      <CommandInput
        onValueChange={(next) => {
          setQuery(next);
          setActiveValue(rankTimezones({ options, query: next })[0]?.value ?? "");
        }}
        placeholder={t("search")}
        value={query}
      />
      <CommandList label={t("results")}>
        <CommandGroup>
          {results.map((option) => (
            <CommandItem
              className="cursor-pointer data-selected:ring-2 data-selected:ring-ring data-selected:ring-inset"
              data-checked={option.value === storedZone}
              key={option.value}
              onSelect={() => onPick(option.value)}
              value={option.value}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <p
        aria-live="polite"
        className={cn("py-6 text-center text-sm", hasResults && "sr-only")}
        role="status"
      >
        {hasResults ? "" : t("empty")}
      </p>
    </Command>
  );
}
