"use client";

import {
  CharacterGraphClusterBySchema,
  CharacterGraphModeSchema,
  type CharacterGraphNodeView,
  RelationshipCategorySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Multiselect } from "@/components/ui/multiselect";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RelationshipGraphCriteria } from "../model/relationship-graph-criteria";

import {
  clearRelationshipGraphFilters,
  hasRelationshipGraphFilters,
  RELATIONSHIP_GRAPH_CRITERIA,
  toRelationshipGraphCategoryOptions,
  toRelationshipGraphTypeOptions,
  withRelationshipGraphMode,
} from "../model/relationship-graph-criteria";
import { useRelationshipLabels } from "../model/use-relationship-labels";

const GRAPH_CONTROLS = {
  noCluster: "__none__",
  noFocus: "__whole__",
} as const;

type RelationshipGraphControlsProps = {
  characters: CharacterGraphNodeView[];
  criteria: RelationshipGraphCriteria;
  onChange: (next: RelationshipGraphCriteria) => void;
};

export function RelationshipGraphControls({
  characters,
  criteria,
  onChange,
}: RelationshipGraphControlsProps) {
  const t = useTranslations("relationships.graph.controls");
  const labels = useRelationshipLabels();
  const ids = {
    categories: useId(),
    clusterBy: useId(),
    depth: useId(),
    focus: useId(),
    types: useId(),
  };
  const categoryOptions = toRelationshipGraphCategoryOptions(criteria.mode);
  const typeOptions = toRelationshipGraphTypeOptions(criteria.mode);

  return (
    <section aria-label={t("title")} className="flex flex-col gap-3">
      <Segmented
        label={t("mode.label")}
        onValueChange={(next) => {
          const mode = CharacterGraphModeSchema.safeParse(next);
          if (mode.success) onChange(withRelationshipGraphMode({ criteria, mode: mode.data }));
        }}
        options={CharacterGraphModeSchema.options.map((mode) => ({
          label: t(`mode.${mode}`),
          value: mode,
        }))}
        value={criteria.mode}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ControlField label={t("focus.label")} labelId={ids.focus}>
          <Select
            onValueChange={(next) =>
              onChange({
                ...criteria,
                focusCharacterId: next === GRAPH_CONTROLS.noFocus ? null : next,
              })
            }
            value={criteria.focusCharacterId ?? GRAPH_CONTROLS.noFocus}
          >
            <SelectTrigger aria-labelledby={ids.focus} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GRAPH_CONTROLS.noFocus}>{t("focus.none")}</SelectItem>
              {characters.map((character) => (
                <SelectItem key={character.id} value={character.id}>
                  {character.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlField>

        <ControlField label={t("depth.label")} labelId={ids.depth}>
          <Select
            disabled={criteria.focusCharacterId === null}
            onValueChange={(next) => onChange({ ...criteria, depth: Number(next) })}
            value={String(criteria.depth)}
          >
            <SelectTrigger aria-labelledby={ids.depth} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_GRAPH_CRITERIA.depthOptions.map((depth) => (
                <SelectItem key={depth} value={String(depth)}>
                  {t("depth.option", { depth })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlField>

        <ControlField label={t("clusterBy.label")} labelId={ids.clusterBy}>
          <Select
            onValueChange={(next) =>
              onChange({
                ...criteria,
                clusterBy: CharacterGraphClusterBySchema.safeParse(next).data ?? null,
              })
            }
            value={criteria.clusterBy ?? GRAPH_CONTROLS.noCluster}
          >
            <SelectTrigger aria-labelledby={ids.clusterBy} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GRAPH_CONTROLS.noCluster}>{t("clusterBy.none")}</SelectItem>
              {CharacterGraphClusterBySchema.options.map((clusterBy) => (
                <SelectItem key={clusterBy} value={clusterBy}>
                  {t(`clusterBy.${clusterBy}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlField>

        {criteria.mode === "all" ? (
          <ControlField label={t("categories.label")} labelId={ids.categories}>
            <Multiselect
              aria-labelledby={ids.categories}
              emptyText={t("categories.empty")}
              onValueChange={(next) =>
                onChange({
                  ...criteria,
                  categories: RelationshipCategorySchema.options.filter((category) =>
                    next.includes(category),
                  ),
                })
              }
              options={categoryOptions.map((category) => ({
                label: labels.category(category),
                value: category,
              }))}
              placeholder={t("categories.placeholder")}
              searchPlaceholder={t("categories.search")}
              value={criteria.categories}
            />
          </ControlField>
        ) : null}

        <ControlField label={t("types.label")} labelId={ids.types}>
          <Multiselect
            aria-labelledby={ids.types}
            emptyText={t("types.empty")}
            onValueChange={(next) =>
              onChange({
                ...criteria,
                relationshipTypes: RelationshipTypeSchema.options.filter((type) =>
                  next.includes(type),
                ),
              })
            }
            options={typeOptions.map((type) => ({ label: labels.type(type), value: type }))}
            placeholder={t("types.placeholder")}
            searchPlaceholder={t("types.search")}
            value={criteria.relationshipTypes}
          />
        </ControlField>
      </div>

      {hasRelationshipGraphFilters(criteria) ? (
        <Button
          className="self-start"
          onClick={() => onChange(clearRelationshipGraphFilters(criteria))}
          size="sm"
          variant="ghost"
        >
          <UiIcon name="x" size={14} />
          {t("reset")}
        </Button>
      ) : null}
    </section>
  );
}

function ControlField({
  children,
  label,
  labelId,
}: {
  children: ReactNode;
  label: string;
  labelId: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground" id={labelId}>
        {label}
      </span>
      {children}
    </div>
  );
}
