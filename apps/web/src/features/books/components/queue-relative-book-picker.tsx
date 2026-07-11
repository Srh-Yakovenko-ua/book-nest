"use client";

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
import { cn } from "@/lib/utils";

import type { QueuePickerItem } from "../model/queue-placement";

type QueueRelativeBookPickerProps = {
  candidates: QueuePickerItem[];
  disabled?: boolean;
  emptyLabel: string;
  id?: string;
  onChange: (bookId: string) => void;
  placeholder: string;
  rowLabel: (item: QueuePickerItem) => string;
  searchPlaceholder: string;
  triggerLabel: string;
  value: null | string;
};

export function QueueRelativeBookPicker({
  candidates,
  disabled = false,
  emptyLabel,
  id,
  onChange,
  placeholder,
  rowLabel,
  searchPlaceholder,
  triggerLabel,
  value,
}: QueueRelativeBookPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = candidates.find((item) => item.id === value) ?? null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={triggerLabel}
          className="w-full justify-between font-normal"
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <span className={cn("truncate", selected === null && "text-muted-foreground")}>
            {selected === null ? placeholder : rowLabel(selected)}
          </span>
          <UiIcon className="ml-2 shrink-0 opacity-60" name="chevron-down" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {candidates.map((item) => (
                <CommandItem
                  className="cursor-pointer"
                  key={item.id}
                  keywords={[item.title]}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  value={item.id}
                >
                  <span className="min-w-0 truncate">{rowLabel(item)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
