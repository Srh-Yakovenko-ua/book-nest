"use client";

import type { Nullable, RelationshipCategory, RelationshipType } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useRelationshipLabels } from "../../model/use-relationship-labels";

type GraphActiveFiltersProps = {
  categories: RelationshipCategory[];
  dormant: boolean;
  filtersTriggerId: string;
  onChange: (filters: { categories: RelationshipCategory[]; types: RelationshipType[] }) => void;
  onReset: () => void;
  types: RelationshipType[];
};

export function GraphActiveFilters({
  categories,
  dormant,
  filtersTriggerId,
  onChange,
  onReset,
  types,
}: GraphActiveFiltersProps) {
  const t = useTranslations("relationships.workspace.filters");
  const labels = useRelationshipLabels();
  const group = useRef<HTMLDivElement>(null);
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
    <div
      aria-label={t("active")}
      className="flex flex-wrap items-center gap-2"
      ref={group}
      role="group"
    >
      {chips.map((chip, index) => (
        <Button
          aria-label={t("remove", { label: chip.label })}
          className="h-7 gap-1 rounded-full px-2.5 text-xs"
          data-filter-chip=""
          key={chip.key}
          onClick={() => {
            chip.remove();
            focusAfterRemoval({ group: group.current, index, triggerId: filtersTriggerId });
          }}
          type="button"
          variant="secondary"
        >
          {chip.label}
          <UiIcon name="x" size={12} />
        </Button>
      ))}
      <Button
        className="h-7 px-2 text-xs"
        onClick={() => {
          onReset();
          focusAfterRemoval({ group: null, index: 0, triggerId: filtersTriggerId });
        }}
        type="button"
        variant="ghost"
      >
        {t("reset")}
      </Button>
    </div>
  );
}

function focusAfterRemoval({
  group,
  index,
  triggerId,
}: {
  group: Nullable<HTMLDivElement>;
  index: number;
  triggerId: string;
}): void {
  requestAnimationFrame(() => {
    const chips =
      group === null || !group.isConnected
        ? []
        : [...group.querySelectorAll<HTMLButtonElement>("button[data-filter-chip]")];
    const next = chips[Math.min(index, chips.length - 1)];
    (next ?? document.getElementById(triggerId))?.focus();
  });
}
