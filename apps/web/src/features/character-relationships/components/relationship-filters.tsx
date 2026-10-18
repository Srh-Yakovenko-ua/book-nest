"use client";

import type { Nullable } from "@app/shared";

import { RelationshipBookStateStatusSchema, RelationshipIntensitySchema } from "@app/shared";
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

import type { RelationshipBookOption } from "../model/relationship-adapter";
import type { RelationshipAdvancedFilters } from "../model/relationship-list-query";

import { RELATIONSHIP_LIST_RESET } from "../model/relationship-list-query";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import {
  RelationshipBookField,
  RelationshipCanonicalField,
  RelationshipTypeField,
} from "./relationship-filter-fields";

type RelationshipFiltersProps = {
  activeCount: number;
  bookOptions: Nullable<readonly RelationshipBookOption[]>;
  onApply: (filters: RelationshipAdvancedFilters) => void;
  values: RelationshipAdvancedFilters;
};

export function RelationshipFilters({
  activeCount,
  bookOptions,
  onApply,
  values,
}: RelationshipFiltersProps) {
  const t = useTranslations("relationships.filters");
  const labels = useRelationshipLabels();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RelationshipAdvancedFilters>(values);

  function patchDraft(patch: Partial<RelationshipAdvancedFilters>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(values);
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          className={cn(
            "h-10 shrink-0",
            activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-10 max-sm:px-0",
          )}
          type="button"
          variant="secondary"
        >
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          {activeCount > 0 ? (
            <Badge className="ml-0.5" variant="secondary">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("types.label")}>
            <RelationshipTypeField draft={draft} onChange={patchDraft} />
          </FilterSection>

          <FilterSection title={t("statuses")}>
            <ChipGroup
              label={t("statuses")}
              mode="multi"
              onValueChange={(next) =>
                patchDraft({
                  relStatus: RelationshipBookStateStatusSchema.options.filter((status) =>
                    next.includes(status),
                  ),
                })
              }
              options={RelationshipBookStateStatusSchema.options.map((status) => ({
                label: labels.status(status),
                value: status,
              }))}
              size="sm"
              value={draft.relStatus}
            />
          </FilterSection>

          <FilterSection title={t("intensities")}>
            <ChipGroup
              label={t("intensities")}
              mode="multi"
              onValueChange={(next) =>
                patchDraft({
                  relIntensity: RelationshipIntensitySchema.options.filter((intensity) =>
                    next.includes(intensity),
                  ),
                })
              }
              options={RelationshipIntensitySchema.options.map((intensity) => ({
                label: labels.intensity(intensity),
                value: intensity,
              }))}
              size="sm"
              value={draft.relIntensity}
            />
          </FilterSection>

          <FilterSection title={t("canonical.label")}>
            <RelationshipCanonicalField draft={draft} onChange={patchDraft} />
          </FilterSection>

          {bookOptions === null ? null : (
            <FilterSection title={t("book.label")}>
              <RelationshipBookField
                bookOptions={bookOptions}
                draft={draft}
                onChange={patchDraft}
              />
            </FilterSection>
          )}
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => setDraft(RELATIONSHIP_LIST_RESET.advanced)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
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
