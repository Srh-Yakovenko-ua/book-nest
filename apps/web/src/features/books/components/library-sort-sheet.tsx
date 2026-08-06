"use client";

import { ArrowUpDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { BooksControllerListSort } from "@/shared/api/generated/model";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type { LibrarySortOption } from "./library-sort-select";

type LibrarySortSheetProps = {
  className?: string;
  label: string;
  onChange: (value: BooksControllerListSort) => void;
  options: LibrarySortOption[];
  value: BooksControllerListSort;
};

type SortGroupKey = "author" | "date" | "favorite_added" | "pages" | "rating" | "title" | "year";

const SORT_GROUP_BY_VALUE: Record<BooksControllerListSort, SortGroupKey> = {
  author_asc: "author",
  author_desc: "author",
  created_asc: "date",
  created_desc: "date",
  favorite_added_asc: "favorite_added",
  favorite_added_desc: "favorite_added",
  pages_asc: "pages",
  pages_desc: "pages",
  rating_asc: "rating",
  rating_desc: "rating",
  title_asc: "title",
  title_desc: "title",
  updated_desc: "date",
  year_asc: "year",
  year_desc: "year",
};

export function LibrarySortSheet({
  className,
  label,
  onChange,
  options,
  value,
}: LibrarySortSheetProps) {
  const t = useTranslations("books.library.sort.mobile");
  const [open, setOpen] = useState(false);

  function handleSelect(next: string) {
    const option = options.find((candidate) => candidate.value === next);
    if (option === undefined) return;
    onChange(option.value);
    setOpen(false);
  }

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <Button
        aria-label={label}
        className={cn("h-10 max-sm:min-w-0 max-sm:shrink max-sm:px-3", className)}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <ArrowUpDown className="shrink-0" />
        <span className="truncate">{t(`trigger.${value}`)}</span>
      </Button>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[88dvh] [&>:first-child]:w-9 [&>:first-child]:bg-border">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <ArrowUpDown aria-hidden className="size-5 shrink-0 text-primary" />
          <DrawerTitle className="flex-1 text-left font-heading text-lg font-semibold text-ink">
            {t("title")}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button
              aria-label={t("close")}
              className="-mr-2.5 size-10 shrink-0 text-muted-foreground hover:bg-transparent hover:text-ink"
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </DrawerClose>
        </div>

        <RadioGroup
          className="flex flex-col overflow-y-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
          onValueChange={handleSelect}
          value={value}
        >
          {groupSortOptions(options).map((group, index) => (
            <div
              className={cn("flex flex-col gap-1.5 py-3", index > 0 && "border-t border-border")}
              key={group.key}
            >
              <p className="px-3 text-[0.6875rem] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                {t(`groups.${group.key}`)}
              </p>
              <div className="flex flex-col gap-1">
                {group.options.map((option) => (
                  <Label
                    className="min-h-6 cursor-pointer gap-3 rounded-lg px-3 py-1 font-normal text-foreground transition-colors hover:bg-secondary/60 has-data-checked:bg-primary/10 has-data-checked:font-medium has-data-checked:text-ink"
                    htmlFor={`library-sort-${option.value}`}
                    key={option.value}
                  >
                    <RadioGroupItem
                      className="size-5 shrink-0"
                      id={`library-sort-${option.value}`}
                      value={option.value}
                    />
                    {t(`options.${option.value}`)}
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

function groupSortOptions(options: LibrarySortOption[]) {
  const groups: { key: SortGroupKey; options: LibrarySortOption[] }[] = [];

  for (const option of options) {
    const key = SORT_GROUP_BY_VALUE[option.value];
    const group = groups.find((candidate) => candidate.key === key);
    if (group === undefined) groups.push({ key, options: [option] });
    else group.options.push(option);
  }

  return groups;
}
