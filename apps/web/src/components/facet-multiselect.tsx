"use client";

import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FacetOption = {
  count: number;
  label: string;
  value: string;
};

type FacetMultiselectProps = {
  emptyText: string;
  isSearching?: boolean;
  label: string;
  onSearchChange?: (next: string) => void;
  onValueChange: (next: string[]) => void;
  options: FacetOption[];
  placeholder: string;
  searchingText?: string;
  searchPlaceholder: string;
  selectedText: (count: number) => string;
  value: string[];
};

export function FacetMultiselect({
  emptyText,
  isSearching,
  label,
  onSearchChange,
  onValueChange,
  options,
  placeholder,
  searchingText,
  searchPlaceholder,
  selectedText,
  value,
}: FacetMultiselectProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const selected = new Set(value);
  const searchesOnServer = onSearchChange !== undefined;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setTerm("");
    onSearchChange?.("");
  }

  function handleTermChange(next: string) {
    setTerm(next);
    onSearchChange?.(next);
  }

  function toggle(optionValue: string) {
    onValueChange(
      selected.has(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button aria-label={label} className="h-10 w-full justify-between" variant="secondary">
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {value.length === 0 ? placeholder : selectedText(value.length)}
          </span>
          <UiIcon
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
            name="chevron-down"
            size={16}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={!searchesOnServer}>
          <CommandInput
            onValueChange={searchesOnServer ? handleTermChange : undefined}
            placeholder={searchPlaceholder}
            value={searchesOnServer ? term : undefined}
          />
          <CommandList>
            <CommandEmpty>
              {isSearching === true ? (searchingText ?? emptyText) : emptyText}
            </CommandEmpty>
            {options.map((option) => (
              <CommandItem
                className="cursor-pointer gap-2.5"
                data-checked={selected.has(option.value)}
                key={option.value}
                keywords={[option.label]}
                onSelect={() => toggle(option.value)}
                value={option.value}
              >
                <Checkbox
                  aria-hidden
                  checked={selected.has(option.value)}
                  className="pointer-events-none"
                  tabIndex={-1}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                <Badge className="min-w-8 justify-center tabular-nums" variant="primary">
                  {option.count}
                </Badge>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
