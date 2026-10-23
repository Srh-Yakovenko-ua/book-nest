"use client";

import type { RelationshipCategory, RelationshipType } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useRelationshipLabels } from "../../model/use-relationship-labels";

type GraphActiveFiltersProps = {
  categories: RelationshipCategory[];
  dormant: boolean;
  onChange: (filters: { categories: RelationshipCategory[]; types: RelationshipType[] }) => void;
  onReset: () => void;
  types: RelationshipType[];
};

export function GraphActiveFilters({
  categories,
  dormant,
  onChange,
  onReset,
  types,
}: GraphActiveFiltersProps) {
  const t = useTranslations("relationships.workspace.filters");
  const labels = useRelationshipLabels();
  if (categories.length === 0 && types.length === 0) return null;

  if (dormant) {
    return <p className="text-xs text-muted-foreground">{t("treeDormant")}</p>;
  }

  const chips = [
    ...categories.map((category) => ({
      key: `category:${category}`,
      label: labels.category(category),
      remove: () =>
        onChange({ categories: categories.filter((entry) => entry !== category), types }),
    })),
    ...types.map((type) => ({
      key: `type:${type}`,
      label: labels.type(type),
      remove: () => onChange({ categories, types: types.filter((entry) => entry !== type) }),
    })),
  ];

  return (
    <div aria-label={t("active")} className="flex flex-wrap items-center gap-2" role="group">
      {chips.map((chip) => (
        <Button
          aria-label={t("remove", { label: chip.label })}
          className="h-7 gap-1 rounded-full px-2.5 text-xs"
          key={chip.key}
          onClick={chip.remove}
          type="button"
          variant="secondary"
        >
          {chip.label}
          <UiIcon name="x" size={12} />
        </Button>
      ))}
      <Button className="h-7 px-2 text-xs" onClick={onReset} type="button" variant="ghost">
        {t("reset")}
      </Button>
    </div>
  );
}
