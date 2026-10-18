"use client";

import type { Nullable } from "@app/shared";

import { CHARACTER_RELATIONSHIP_LIST_LIMITS, RelationshipCategorySchema } from "@app/shared";
import { useTranslations } from "next-intl";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";

import type { RelationshipBookOption } from "../model/relationship-adapter";
import type { UseRelationshipListQueryResult } from "../model/use-relationship-list-query";

import {
  countRelationshipAdvancedFilters,
  toRelationshipAdvancedFilters,
} from "../model/relationship-list-query";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipFilters } from "./relationship-filters";
import { RelationshipSort } from "./relationship-sort";

type RelationshipListToolbarProps = {
  bookOptions: Nullable<readonly RelationshipBookOption[]>;
  onCreate?: () => void;
  query: UseRelationshipListQueryResult;
};

export function RelationshipListToolbar({
  bookOptions,
  onCreate,
  query,
}: RelationshipListToolbarProps) {
  const t = useTranslations("relationships.toolbar");
  const labels = useRelationshipLabels();
  const { state } = query;
  const advancedFilters = toRelationshipAdvancedFilters(state);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            isCommittable={alwaysCommittable}
            label={t("searchLabel")}
            maxLength={CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMax}
            onClear={() => query.setSearch("")}
            onSearch={query.setSearch}
            placeholder={t("searchPlaceholder")}
            value={state.relQ}
          />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <RelationshipFilters
            activeCount={countRelationshipAdvancedFilters(advancedFilters)}
            bookOptions={bookOptions}
            onApply={query.setAdvancedFilters}
            values={advancedFilters}
          />
          <RelationshipSort onChange={query.setSort} value={state.relSort} />
          {onCreate === undefined ? null : (
            <Button className="h-10 shrink-0" onClick={onCreate} type="button">
              <UiIcon name="plus" size={16} />
              <span className="max-sm:sr-only">{t("create")}</span>
            </Button>
          )}
        </div>
      </div>

      {query.isSearchTooShort ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {t("searchTooShort", { min: CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMin })}
        </p>
      ) : null}

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("categoriesLabel")}
          mode="multi"
          onValueChange={(next) =>
            query.setCategories(
              RelationshipCategorySchema.options.filter((category) => next.includes(category)),
            )
          }
          options={RelationshipCategorySchema.options.map((category) => ({
            label: labels.category(category),
            value: category,
          }))}
          size="sm"
          value={state.relCat}
        />
      </div>

      {query.hasListState ? (
        <div>
          <Button className="h-auto p-0" onClick={query.clearAll} size="sm" variant="link">
            {t("clearAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function alwaysCommittable(): boolean {
  return true;
}
