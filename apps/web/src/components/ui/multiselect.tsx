"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

import { UiIcon } from "@/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type MultiselectOption = {
  label: string;
  value: string;
};

type MultiselectProps = {
  "aria-labelledby"?: string;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
  id?: string;
  onValueChange: (value: string[]) => void;
  options: MultiselectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value: string[];
};

function Multiselect({
  className,
  disabled,
  emptyText = "Нічого не знайдено",
  id,
  onValueChange,
  options,
  placeholder = "Оберіть або додайте",
  searchPlaceholder = "Пошук…",
  value,
  ...props
}: MultiselectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOptions = value
    .map((selected) => options.find((option) => option.value === selected))
    .filter((option): option is MultiselectOption => option !== undefined);

  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    onValueChange(next);
    setQuery("");
  };

  const removeLast = () => {
    if (value.length === 0) return;
    onValueChange(value.slice(0, -1));
  };

  return (
    <PopoverPrimitive.Root onOpenChange={setOpen} open={disabled ? false : open}>
      <PopoverPrimitive.Anchor asChild>
        <div
          aria-disabled={disabled || undefined}
          className={cn(
            "relative flex min-h-[2.875rem] flex-wrap items-center gap-1.5 rounded-lg border border-input bg-field py-[7px] pr-10 pl-2.5 transition-[border-color,box-shadow] has-[[data-slot=multiselect-trigger]:focus-visible]:border-ring has-[[data-slot=multiselect-trigger]:focus-visible]:ring-[3px] has-[[data-slot=multiselect-trigger]:focus-visible]:ring-ring/50 has-[[data-slot=multiselect-trigger]:hover]:not-aria-disabled:border-accent-border aria-disabled:cursor-not-allowed aria-disabled:bg-secondary aria-disabled:opacity-60",
            open && "border-ring ring-[3px] ring-ring/50",
            className,
          )}
          data-empty={selectedOptions.length === 0}
          data-slot="multiselect"
        >
          <PopoverPrimitive.Trigger asChild>
            <button
              aria-haspopup="listbox"
              aria-label={placeholder}
              className="absolute inset-0 z-0 cursor-pointer rounded-lg outline-none disabled:cursor-not-allowed"
              data-slot="multiselect-trigger"
              disabled={disabled}
              id={id}
              type="button"
              {...props}
            />
          </PopoverPrimitive.Trigger>
          {selectedOptions.map((option) => (
            <span
              className="relative z-10 inline-flex max-w-full items-center gap-1.5 rounded-sm bg-tag py-1 pr-1.5 pl-2.5 text-[0.8125rem] font-medium text-tag-foreground"
              data-slot="multiselect-chip"
              key={option.value}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {option.label}
              </span>
              {disabled ? null : (
                <button
                  aria-label={`Прибрати ${option.label}`}
                  className="relative grid size-[17px] shrink-0 cursor-pointer place-items-center rounded-full text-tag-foreground opacity-60 transition-[opacity,background-color] after:absolute after:-inset-1 hover:bg-ink/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  data-slot="multiselect-remove"
                  onClick={() => toggle(option.value)}
                  type="button"
                >
                  <UiIcon className="size-3" name="x" size={12} />
                </button>
              )}
            </span>
          ))}
          {selectedOptions.length === 0 ? (
            <span className="pointer-events-none relative z-0 min-w-[90px] flex-1 py-1 text-left text-[0.9375rem] text-muted-foreground">
              {placeholder}
            </span>
          ) : null}
          <UiIcon
            className={cn(
              "pointer-events-none absolute top-[14px] right-[14px] z-10 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            name="chevron-down"
            size={18}
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-(--radix-popover-trigger-width) origin-(--radix-popover-content-transform-origin) rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-pop outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            setTimeout(() => inputRef.current?.focus());
          }}
          sideOffset={6}
        >
          <Command
            className="bg-transparent"
            onKeyDown={(event) => {
              if (event.key === "Backspace" && query === "" && !event.repeat) removeLast();
            }}
          >
            <CommandInput
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              ref={inputRef}
              value={query}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = value.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      keywords={[option.label]}
                      onSelect={() => toggle(option.value)}
                      value={option.value}
                    >
                      <span
                        className={cn(
                          "grid size-[18px] shrink-0 place-items-center rounded-[6px] border-[1.5px] border-border bg-card transition-colors",
                          selected && "border-primary bg-primary",
                        )}
                      >
                        <UiIcon
                          className={cn(
                            "size-3 text-primary-foreground opacity-0",
                            selected && "opacity-100",
                          )}
                          name="check"
                          size={12}
                        />
                      </span>
                      <span className="truncate font-medium">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { Multiselect, type MultiselectOption };
