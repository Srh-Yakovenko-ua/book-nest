"use client";

import { ArrowUpDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type { SeriesSort } from "../model/series-derive";

import { SERIES_SORT_OPTIONS } from "../model/series-derive";

type SeriesSortSheetProps = {
  className?: string;
  onChange: (value: SeriesSort) => void;
  value: SeriesSort;
};

export function SeriesSortSheet({ className, onChange, value }: SeriesSortSheetProps) {
  const t = useTranslations("series.sort");
  const tMobile = useTranslations("series.sort.mobile");
  const tToolbar = useTranslations("series.toolbar");
  const [open, setOpen] = useState(false);

  function handleSelect(next: string) {
    const option = SERIES_SORT_OPTIONS.find((candidate) => candidate === next);
    if (option === undefined) return;
    onChange(option);
    setOpen(false);
  }

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <Button
        aria-label={tToolbar("sortLabel")}
        className={cn("h-10 min-w-0 flex-1 px-3", className)}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <ArrowUpDown className="shrink-0" />
        <span className="truncate">{tMobile(`trigger.${value}`)}</span>
      </Button>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[88dvh] [&>:first-child]:w-9 [&>:first-child]:bg-border">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <ArrowUpDown aria-hidden className="size-5 shrink-0 text-primary" />
          <DrawerTitle className="flex-1 text-left font-heading text-lg font-semibold text-ink">
            {tMobile("title")}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button
              aria-label={tMobile("close")}
              className="-mr-2.5 size-10 shrink-0 text-muted-foreground hover:bg-transparent hover:text-ink"
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </DrawerClose>
        </div>

        <RadioGroup
          className="flex flex-col gap-1 overflow-y-auto px-5 py-3 pb-[calc(2rem+env(safe-area-inset-bottom))]"
          onValueChange={handleSelect}
          value={value}
        >
          {SERIES_SORT_OPTIONS.map((option) => (
            <Label
              className="min-h-6 cursor-pointer gap-3 rounded-lg px-3 py-1.5 font-normal text-foreground transition-colors hover:bg-secondary/60 has-data-checked:bg-primary/10 has-data-checked:font-medium has-data-checked:text-ink"
              htmlFor={`series-sort-${option}`}
              key={option}
            >
              <RadioGroupItem
                className="size-5 shrink-0"
                id={`series-sort-${option}`}
                value={option}
              />
              {t(option)}
            </Label>
          ))}
        </RadioGroup>
      </DrawerContent>
    </Drawer>
  );
}
