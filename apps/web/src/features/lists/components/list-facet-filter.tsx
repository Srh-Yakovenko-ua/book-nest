"use client";

import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ListFacetFilterProps = {
  emptyText: string;
  label: string;
  onValueChange: (next: string[]) => void;
  options: ListFacetOption[];
  placeholder: string;
  searchPlaceholder: string;
  selectedText: (count: number) => string;
  value: string[];
};

type ListFacetOption = {
  count: number;
  label: string;
  value: string;
};

export function ListFacetFilter({
  emptyText,
  label,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  selectedText,
  value,
}: ListFacetFilterProps) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  function toggle(optionValue: string) {
    onValueChange(
      selected.has(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
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
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                className="cursor-pointer"
                data-checked={selected.has(option.value)}
                key={option.value}
                keywords={[option.label]}
                onSelect={() => toggle(option.value)}
                value={option.value}
              >
                <span className="truncate font-medium">{option.label}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{option.count}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
