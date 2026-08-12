"use client";

import { ArrowUpDown, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export type MobileSortGroup<TValue extends string> = {
  key: string;
  label?: string;
  options: MobileSortOption<TValue>[];
};

export type MobileSortOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type MobileSortGroupsInput<TValue extends string, TGroupKey extends string> = {
  groupKeyByValue: Record<TValue, TGroupKey>;
  groupLabel: (key: TGroupKey) => string;
  optionLabel: (value: TValue) => string;
  values: readonly TValue[];
};

type MobileSortSheetProps<TValue extends string> = {
  className?: string;
  closeLabel: string;
  groups: MobileSortGroup<TValue>[];
  id: string;
  label: string;
  onChange: (value: TValue) => void;
  title: string;
  triggerLabel: string;
  value: TValue;
};

export function buildMobileSortGroups<TValue extends string, TGroupKey extends string>({
  groupKeyByValue,
  groupLabel,
  optionLabel,
  values,
}: MobileSortGroupsInput<TValue, TGroupKey>): MobileSortGroup<TValue>[] {
  const groups: MobileSortGroup<TValue>[] = [];

  for (const value of values) {
    const key = groupKeyByValue[value];
    const option = { label: optionLabel(value), value };
    const group = groups.find((candidate) => candidate.key === key);
    if (group === undefined) groups.push({ key, label: groupLabel(key), options: [option] });
    else group.options.push(option);
  }

  return groups;
}

export function MobileSortSheet<TValue extends string>({
  className,
  closeLabel,
  groups,
  id,
  label,
  onChange,
  title,
  triggerLabel,
  value,
}: MobileSortSheetProps<TValue>) {
  const [open, setOpen] = useState(false);

  function handleSelect(next: string) {
    const option = groups
      .flatMap((group) => group.options)
      .find((candidate) => candidate.value === next);
    if (option === undefined) return;
    onChange(option.value);
    setOpen(false);
  }

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <Button
        aria-label={label}
        className={cn("h-10 min-w-0 flex-1 px-3", className)}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <ArrowUpDown className="shrink-0" />
        <span className="truncate">{triggerLabel}</span>
      </Button>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[88dvh] [&>:first-child]:w-9 [&>:first-child]:bg-border">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <ArrowUpDown aria-hidden className="size-5 shrink-0 text-primary" />
          <DrawerTitle className="flex-1 text-left font-heading text-lg font-semibold text-ink">
            {title}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button
              aria-label={closeLabel}
              className="-mr-2.5 size-10 shrink-0 text-muted-foreground hover:bg-transparent hover:text-ink"
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </DrawerClose>
        </div>

        <RadioGroup
          className="flex flex-col overflow-y-auto px-5 py-1 pb-[calc(2rem+env(safe-area-inset-bottom))]"
          onValueChange={handleSelect}
          value={value}
        >
          {groups.map((group, index) => (
            <div
              className={cn("flex flex-col gap-1.5 py-3", index > 0 && "border-t border-border")}
              key={group.key}
            >
              {group.label === undefined ? null : (
                <p className="px-3 text-[0.6875rem] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {group.options.map((option) => (
                  <Label
                    className="min-h-6 cursor-pointer gap-3 rounded-lg px-3 py-1.5 font-normal text-foreground transition-colors hover:bg-secondary/60 has-data-checked:bg-primary/10 has-data-checked:font-medium has-data-checked:text-ink"
                    htmlFor={`${id}-${option.value}`}
                    key={option.value}
                  >
                    <RadioGroupItem
                      className="size-5 shrink-0"
                      id={`${id}-${option.value}`}
                      value={option.value}
                    />
                    {option.label}
                  </Label>
                ))}
              </div>
            </div>
          ))}
        </RadioGroup>
      </DrawerContent>
    </Drawer>
  );
}
