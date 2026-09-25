"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

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
  resolveLabel?: (value: string) => string | undefined;
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
  resolveLabel,
  searchingText,
  searchPlaceholder,
  selectedText,
  value,
}: FacetMultiselectProps) {
  const t = useTranslations("facetMultiselect");
  const triggerId = useId();
  const labelId = `${triggerId}-label`;
  const valueId = `${triggerId}-value`;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [pinnedOnOpen, setPinnedOnOpen] = useState<ReadonlySet<string>>(() => new Set(value));
  const selected = new Set(value);
  const searchesOnServer = onSearchChange !== undefined;
  const orderedOptions = [
    ...options.filter((option) => pinnedOnOpen.has(option.value)),
    ...options.filter((option) => !pinnedOnOpen.has(option.value)),
  ];

  function labelOf(optionValue: string) {
    return (
      options.find((option) => option.value === optionValue)?.label ??
      resolveLabel?.(optionValue) ??
      optionValue
    );
  }

  function triggerText() {
    const [onlyValue] = value;
    if (onlyValue === undefined) return placeholder;
    if (value.length === 1) return labelOf(onlyValue);
    return selectedText(value.length);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPinnedOnOpen(new Set(value));
      return;
    }
    setTerm("");
    onSearchChange?.("");
  }

  function handleTermChange(next: string) {
    setTerm(next);
    onSearchChange?.(next);
  }

  function remove(optionValue: string) {
    onValueChange(value.filter((item) => item !== optionValue));
  }

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      remove(optionValue);
      return;
    }
    onValueChange([...value, optionValue]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-labelledby={`${labelId} ${valueId}`}
            className="h-10 w-full justify-between"
            variant="secondary"
          >
            <span className="sr-only" id={labelId}>
              {label}
            </span>
            <span
              className={cn("truncate", value.length === 0 && "text-muted-foreground")}
              id={valueId}
            >
              {triggerText()}
            </span>
            <UiIcon
              className={cn("shrink-0 transition-transform", open && "rotate-180")}
              name="chevron-down"
              size={16}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command label={label} shouldFilter={!searchesOnServer}>
            <CommandInput
              onValueChange={searchesOnServer ? handleTermChange : undefined}
              placeholder={searchPlaceholder}
              value={searchesOnServer ? term : undefined}
            />
            <CommandList label={label}>
              <CommandEmpty>
                {isSearching === true ? (searchingText ?? emptyText) : emptyText}
              </CommandEmpty>
              {orderedOptions.map((option) => (
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
      {value.length > 0 ? (
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {value.map((selectedValue) => {
            const selectedLabel = labelOf(selectedValue);
            return (
              <li
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-tag py-0.5 pr-0.5 pl-3 text-sm font-medium text-tag-foreground"
                key={selectedValue}
              >
                <span className="truncate">{selectedLabel}</span>
                <button
                  aria-label={t("remove", { label: selectedLabel })}
                  className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border border-transparent text-tag-foreground opacity-60 transition-[opacity,background-color] hover:bg-ink/10 hover:opacity-100 focus-visible:border-ring focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => remove(selectedValue)}
                  type="button"
                >
                  <UiIcon className="size-3" name="x" size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
