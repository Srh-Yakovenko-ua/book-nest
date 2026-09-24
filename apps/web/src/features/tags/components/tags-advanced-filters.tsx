"use client";

import type { TagColor } from "@app/shared";

import { TAG_COLORS, TagTypeSchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { TagsAdvancedFiltersValue } from "../model/use-tag-query";

import { TAG_COLOR_SWATCH, TagColorSelection, TagColorSwatchButton } from "./tag-color-swatch";

type TagsAdvancedFiltersProps = {
  onApply: (filters: TagsAdvancedFiltersValue) => void;
  value: TagsAdvancedFiltersValue;
};

const EMPTY_ADVANCED_FILTERS: TagsAdvancedFiltersValue = { color: [], type: [] };

export function TagsAdvancedFilters({ onApply, value }: TagsAdvancedFiltersProps) {
  const t = useTranslations("tags.advancedFilters");
  const tType = useTranslations("tags.types");
  const tColor = useTranslations("tags.colors");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TagsAdvancedFiltersValue>(value);
  const activeCount = value.type.length + value.color.length;

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(value);
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          className={cn("h-10", activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-10 max-sm:px-0")}
          type="button"
          variant="secondary"
        >
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          {activeCount > 0 ? (
            <>
              <Badge aria-hidden className="ml-0.5" variant="secondary">
                {activeCount}
              </Badge>
              <span className="sr-only">{t("activeCount", { count: activeCount })}</span>
            </>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("sections.types")}>
            <ChipGroup
              label={t("sections.types")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({ ...prev, type: parseAll(next, TagTypeSchema.options) }))
              }
              options={TagTypeSchema.options.map((type) => ({ label: tType(type), value: type }))}
              size="sm"
              value={draft.type}
            />
          </FilterSection>

          <FilterSection title={t("sections.colors")}>
            <div className="flex flex-col gap-2">
              <ul aria-label={t("sections.colors")} className={TAG_COLOR_SWATCH.grid}>
                {TAG_COLORS.map((color) => {
                  const isSelected = draft.color.includes(color);
                  return (
                    <li key={color}>
                      <TagColorSwatchButton
                        aria-label={tColor(color)}
                        aria-pressed={isSelected}
                        color={color}
                        isSelected={isSelected}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, color: toggleColor(prev.color, color) }))
                        }
                        tooltip={tColor(color)}
                      />
                    </li>
                  );
                })}
              </ul>
              <TagColorSelection colors={draft.color} />
            </div>
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button onClick={() => setDraft(EMPTY_ADVANCED_FILTERS)} type="button" variant="ghost">
            {t("reset")}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            type="button"
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function parseAll<TValue extends string>(values: string[], allowed: readonly TValue[]): TValue[] {
  return allowed.filter((option) => values.includes(option));
}

function toggleColor(colors: readonly TagColor[], color: TagColor): TagColor[] {
  return colors.includes(color)
    ? colors.filter((selected) => selected !== color)
    : TAG_COLORS.filter((option) => option === color || colors.includes(option));
}
