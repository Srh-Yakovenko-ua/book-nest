"use client";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useRecentStores } from "../api/use-recent-stores";

type StoreAutocompleteProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  label: string;
  onChange: (next: string) => void;
  placeholder: string;
  value: string;
};

export function StoreAutocomplete({
  describedBy,
  id,
  invalid,
  label,
  onChange,
  placeholder,
  value,
}: StoreAutocompleteProps) {
  const t = useTranslations("books");
  const [open, setOpen] = useState(false);
  const { data: recentStores = [] } = useRecentStores();

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const filteredStores =
    normalized.length === 0
      ? recentStores
      : recentStores.filter((store) => store.toLowerCase().includes(normalized));
  const showCreateOption =
    trimmed.length > 0 && !recentStores.some((store) => store.toLowerCase() === normalized);

  function pickStore(store: string) {
    onChange(store);
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  const showClear = value.length > 0;

  return (
    <CommandPrimitive label={label} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <UiIcon
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3",
                invalid ? "text-destructive" : "text-muted-foreground",
              )}
              name="store"
              size={18}
            />
            <CommandPrimitive.Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="off"
              className={cn(
                "h-10 w-full rounded-md border border-input bg-field pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                showClear ? "pr-10" : "pr-3",
                invalid &&
                  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
              )}
              id={id}
              onClick={() => setOpen(true)}
              onFocus={() => setOpen(true)}
              onValueChange={(next) => {
                onChange(next);
                setOpen(true);
              }}
              placeholder={placeholder}
              value={value}
            />
            {showClear ? (
              <button
                aria-label={t("fields.clear")}
                className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={handleClear}
                type="button"
              >
                <UiIcon name="x" size={16} />
              </button>
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={6}
        >
          <CommandList>
            {filteredStores.length === 0 && !showCreateOption ? (
              <CommandEmpty>{t("store.empty")}</CommandEmpty>
            ) : null}
            {filteredStores.length > 0 ? (
              <CommandGroup heading={t("store.recentHeading")}>
                {filteredStores.map((store) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={store}
                    onSelect={() => pickStore(store)}
                    value={store}
                  >
                    <UiIcon className="text-muted-foreground" name="store" size={16} />
                    <span className="min-w-0 truncate">{store}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {showCreateOption ? (
              <CommandGroup>
                <CommandItem
                  className="cursor-pointer"
                  onSelect={() => pickStore(trimmed)}
                  value={`create-${trimmed}`}
                >
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">
                    {t("store.createNew", { name: trimmed })}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}
