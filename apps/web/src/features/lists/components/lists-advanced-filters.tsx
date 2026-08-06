"use client";

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

import type { ListsQueryState } from "../model/lists-query";
import type { UseListsQueryResult } from "../model/use-lists-query";

import {
  activeListFilterCount,
  LIST_DESCRIPTION_VALUES,
  LIST_FILL_VALUES,
  LIST_SIZE_VALUES,
} from "../model/lists-query";

type ListsAdvancedFiltersProps = {
  setState: UseListsQueryResult["setState"];
  state: ListsQueryState;
};

type ListsFiltersDraft = Pick<ListsQueryState, "description" | "fill" | "size">;

const EMPTY_FILTERS: ListsFiltersDraft = { description: [], fill: [], size: [] };

export function ListsAdvancedFilters({ setState, state }: ListsAdvancedFiltersProps) {
  const t = useTranslations("lists.catalog.filters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ListsFiltersDraft>(() => draftFromState(state));
  const activeCount = activeListFilterCount(state);
  const hasDraftFilters = activeListFilterCount({ ...state, ...draft }) > 0;

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(draftFromState(state));
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button className="h-10" type="button" variant="secondary">
          <UiIcon name="sliders" size={16} />
          {t("trigger")}
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
          <FilterSection title={t("sections.fill")}>
            <ChipGroup
              label={t("sections.fill")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  fill: LIST_FILL_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={LIST_FILL_VALUES.map((value) => ({
                label: t(`fillOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft.fill}
            />
          </FilterSection>

          <FilterSection title={t("sections.description")}>
            <ChipGroup
              label={t("sections.description")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  description: LIST_DESCRIPTION_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={LIST_DESCRIPTION_VALUES.map((value) => ({
                label: t(`descriptionOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft.description}
            />
          </FilterSection>

          <FilterSection title={t("sections.size")}>
            <ChipGroup
              label={t("sections.size")}
              mode="multi"
              onValueChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  size: LIST_SIZE_VALUES.filter((value) => next.includes(value)),
                }))
              }
              options={LIST_SIZE_VALUES.map((value) => ({
                label: t(`sizeOptions.${value}`),
                value,
              }))}
              size="sm"
              value={draft.size}
            />
          </FilterSection>
        </div>

        <SheetFooter>
          <Button
            disabled={!hasDraftFilters}
            onClick={() => setDraft(EMPTY_FILTERS)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            onClick={() => {
              void setState(toCommitPatch(draft));
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

function draftFromState(state: ListsQueryState): ListsFiltersDraft {
  return { description: state.description, fill: state.fill, size: state.size };
}

function toCommitPatch(draft: ListsFiltersDraft) {
  return {
    description: draft.description.length === 0 ? null : draft.description,
    fill: draft.fill.length === 0 ? null : draft.fill,
    size: draft.size.length === 0 ? null : draft.size,
  };
}
