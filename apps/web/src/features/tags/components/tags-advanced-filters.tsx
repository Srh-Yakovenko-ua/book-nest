"use client";

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

import { tagColorStyle } from "../model/tag-color";

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
            <ChipGroup
              label={t("sections.colors")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({ ...prev, color: parseAll(next, TAG_COLORS) }))
              }
              options={TAG_COLORS.map((color) => ({
                icon: (
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full border"
                    style={tagColorStyle(color)}
                  />
                ),
                label: tColor(color),
                value: color,
              }))}
              size="sm"
              value={draft.color}
            />
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
