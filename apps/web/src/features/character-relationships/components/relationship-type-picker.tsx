"use client";

import type { Nullable, RelationshipCategory, RelationshipType } from "@app/shared";
import type { Ref } from "react";

import {
  getRelationshipTypeDirectionality,
  isCatalogRelationshipType,
  RELATIONSHIP_CATEGORY_TYPES,
} from "@app/shared";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLockedWheelScroll } from "@/hooks/use-locked-wheel-scroll";

import { useRelationshipLabels } from "../model/use-relationship-labels";

type RelationshipTypePickerProps = {
  category: RelationshipCategory;
  describedBy?: string;
  id: string;
  invalid: boolean;
  onBlur: () => void;
  onChange: (type: RelationshipType) => void;
  ref?: Ref<HTMLButtonElement>;
  value: Nullable<RelationshipType>;
};

export function RelationshipTypePicker({
  category,
  describedBy,
  id,
  invalid,
  onBlur,
  onChange,
  ref,
  value,
}: RelationshipTypePickerProps) {
  const t = useTranslations("relationships.editor.type");
  const labels = useRelationshipLabels();
  const [open, setOpen] = useState(false);
  const listRef = useLockedWheelScroll();

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) onBlur();
  }

  function pick(type: RelationshipType) {
    onChange(type);
    toggle(false);
  }

  return (
    <Popover onOpenChange={toggle} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-invalid={invalid}
          className="h-10 w-full justify-between gap-2 px-3 font-normal"
          data-relationship-autofocus=""
          id={id}
          ref={ref}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className={value === null ? "truncate text-muted-foreground" : "truncate"}>
            {value === null ? t("placeholder") : labels.type(value)}
          </span>
          <ChevronsUpDown aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput aria-label={t("search")} placeholder={t("search")} />
          <CommandList ref={listRef}>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            {RELATIONSHIP_CATEGORY_TYPES[category].map((type) => (
              <CommandItem
                className="cursor-pointer"
                data-checked={type === value}
                key={type}
                keywords={[labels.type(type)]}
                onSelect={() => pick(type)}
                value={type}
              >
                <span className="min-w-0 flex-1 truncate">{labels.type(type)}</span>
                {isCatalogRelationshipType(type) ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {labels.directionality(getRelationshipTypeDirectionality(type))}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
