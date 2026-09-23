"use client";

import type { IsoCountryCode, Nullable } from "@app/shared";

import { ISO_COUNTRY_CODES } from "@app/shared";
import { useLocale } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CountryOption = { code: IsoCountryCode; label: string };

type CountrySelectLabels = {
  clear: string;
  empty: string;
  placeholder: string;
  search: string;
};

type CountrySelectProps = {
  ariaDescribedBy?: string;
  id: string;
  invalid?: boolean;
  labels: CountrySelectLabels;
  onChange: (countryCode: Nullable<IsoCountryCode>) => void;
  value: Nullable<string>;
};

export function CountrySelect({
  ariaDescribedBy,
  id,
  invalid = false,
  labels,
  onChange,
  value,
}: CountrySelectProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const options = countryOptions(regionNames, locale);
  const selectedLabel = value === null ? null : regionLabel(regionNames, value);

  return (
    <div className="flex items-center gap-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-describedby={ariaDescribedBy}
            aria-expanded={open}
            aria-invalid={invalid}
            className="h-10 min-w-0 flex-1 justify-between font-normal"
            id={id}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span
              className={selectedLabel === null ? "truncate text-muted-foreground" : "truncate"}
            >
              {selectedLabel ?? labels.placeholder}
            </span>
            <UiIcon className="ml-2 shrink-0 opacity-60" name="chevron-down" size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={labels.search} />
            <CommandList>
              <CommandEmpty>{labels.empty}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    className="cursor-pointer justify-between gap-2"
                    key={option.code}
                    keywords={[option.label]}
                    onSelect={() => {
                      setOpen(false);
                      onChange(option.code);
                    }}
                    value={option.code}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {option.code === value ? (
                      <UiIcon className="shrink-0 text-primary" name="check" size={16} />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value === null ? null : (
        <Button
          aria-label={labels.clear}
          className="size-10 shrink-0"
          onClick={() => onChange(null)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <UiIcon name="x" size={16} />
        </Button>
      )}
    </div>
  );
}

function countryOptions(regionNames: Intl.DisplayNames, locale: string): CountryOption[] {
  const collator = new Intl.Collator(locale);
  return ISO_COUNTRY_CODES.map((code) => ({ code, label: regionLabel(regionNames, code) })).sort(
    (left, right) => collator.compare(left.label, right.label),
  );
}

function regionLabel(regionNames: Intl.DisplayNames, code: string): string {
  try {
    return regionNames.of(code.trim().toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
