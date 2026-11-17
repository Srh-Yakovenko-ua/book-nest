"use client";

import {
  type RelationshipCategory,
  RelationshipCategorySchema,
  type RelationshipType,
  RelationshipTypeSchema,
} from "@app/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Multiselect } from "@/components/ui/multiselect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useRelationshipLabels } from "../../model/use-relationship-labels";
import {
  countGraphWorkspaceFilters,
  toAllowedGraphWorkspaceTypes,
} from "../../model/workspace/graph-workspace-params";

type GraphWorkspaceFiltersProps = {
  categories: RelationshipCategory[];
  disabled: boolean;
  onChange: (filters: { categories: RelationshipCategory[]; types: RelationshipType[] }) => void;
  onReset: () => void;
  triggerId: string;
  types: RelationshipType[];
};

export function GraphWorkspaceFilters({
  categories,
  disabled,
  onChange,
  onReset,
  triggerId,
  types,
}: GraphWorkspaceFiltersProps) {
  const t = useTranslations("relationships.workspace.filters");
  const tControls = useTranslations("relationships.graph.controls");
  const labels = useRelationshipLabels();
  const ids = { categories: useId(), types: useId() };
  const count = countGraphWorkspaceFilters({ categories, types });
  const allowedTypes = toAllowedGraphWorkspaceTypes(categories);
  const typeOptions = RelationshipTypeSchema.options.filter(
    (type) => type !== "custom" && (allowedTypes === null || allowedTypes.has(type)),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button disabled={disabled} id={triggerId} type="button" variant="outline">
          <UiIcon name="filter" size={16} />
          {count === 0 ? t("trigger") : t("triggerCount", { count })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 max-w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id={ids.categories}>
            {t("categories")}
          </span>
          <Multiselect
            aria-labelledby={ids.categories}
            emptyText={tControls("categories.empty")}
            onValueChange={(next) =>
              onChange({
                categories: RelationshipCategorySchema.options.filter((category) =>
                  next.includes(category),
                ),
                types,
              })
            }
            options={RelationshipCategorySchema.options.map((category) => ({
              label: labels.category(category),
              value: category,
            }))}
            placeholder={tControls("categories.placeholder")}
            searchPlaceholder={tControls("categories.search")}
            value={categories}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id={ids.types}>
            {t("types")}
          </span>
          <Multiselect
            aria-labelledby={ids.types}
            emptyText={tControls("types.empty")}
            onValueChange={(next) =>
              onChange({
                categories,
                types: RelationshipTypeSchema.options.filter((type) => next.includes(type)),
              })
            }
            options={typeOptions.map((type) => ({ label: labels.type(type), value: type }))}
            placeholder={tControls("types.placeholder")}
            searchPlaceholder={tControls("types.search")}
            value={types}
          />
        </div>
        <Button disabled={count === 0} onClick={onReset} type="button" variant="ghost">
          {t("reset")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
