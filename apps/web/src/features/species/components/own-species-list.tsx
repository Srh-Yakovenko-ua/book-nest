"use client";

import type { Nullable, OwnSpeciesView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import type { OwnSpeciesFilters } from "../model/own-species-filters";

import { useOwnSpecies } from "../api/use-own-species";
import {
  countOwnSpeciesByUsage,
  filterOwnSpecies,
  OWN_SPECIES_FILTERS,
} from "../model/own-species-filters";
import { OwnSpeciesRow } from "./own-species-row";

type OwnSpeciesListProps = {
  filters: OwnSpeciesFilters;
  onDelete: (species: OwnSpeciesView) => void;
  onFiltersChange: (filters: OwnSpeciesFilters) => void;
  onMerge: (species: OwnSpeciesView) => void;
  onRename: (species: OwnSpeciesView) => void;
  returnFocusTo: Nullable<string>;
};

const LIST_SKELETON_ROWS = 3;

export function OwnSpeciesList({
  filters,
  onDelete,
  onFiltersChange,
  onMerge,
  onRename,
  returnFocusTo,
}: OwnSpeciesListProps) {
  const t = useTranslations("species.manage");
  const ownSpecies = useOwnSpecies();
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isFocusReturnPendingRef = useRef(returnFocusTo !== null);
  const isSettled = ownSpecies.isSuccess && !ownSpecies.isFetching;

  useEffect(() => {
    if (!isSettled || !isFocusReturnPendingRef.current) return;
    isFocusReturnPendingRef.current = false;
    (returnFocusRef.current ?? searchRef.current)?.focus();
  }, [isSettled]);

  if (ownSpecies.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <span className="sr-only">{t("loading")}</span>
        {Array.from({ length: LIST_SKELETON_ROWS }, (_, index) => (
          <Skeleton className="h-16 w-full rounded-xl" key={index} />
        ))}
      </div>
    );
  }

  if (ownSpecies.isError) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl bg-error-soft p-3" role="alert">
        <p className="text-sm text-error">{t("loadFailed")}</p>
        <Button
          onClick={() => void ownSpecies.refetch()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (ownSpecies.data.length === 0) {
    return <EmptyNotice>{t("empty")}</EmptyNotice>;
  }

  const counts = countOwnSpeciesByUsage(ownSpecies.data);
  const visibleSpecies = filterOwnSpecies(ownSpecies.data, filters);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-3">
        <Input
          aria-label={t("searchLabel")}
          autoComplete="off"
          className="h-10"
          enterKeyHint="search"
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
          placeholder={t("searchPlaceholder")}
          ref={searchRef}
          type="search"
          value={filters.query}
        />
        <ChipGroup
          label={t("filters.label")}
          mode="single"
          onValueChange={(next) => {
            const usage = OWN_SPECIES_FILTERS.usages.find((filter) => filter === next);
            if (usage !== undefined) onFiltersChange({ ...filters, usage });
          }}
          options={OWN_SPECIES_FILTERS.usages.map((filter) => ({
            count: counts[filter],
            label: t(`filters.${filter}`),
            value: filter,
          }))}
          size="sm"
          value={filters.usage}
        />
      </div>

      {visibleSpecies.length === 0 ? (
        <EmptyNotice>{t("noMatches")}</EmptyNotice>
      ) : (
        <ul
          aria-label={t("listLabel")}
          className="min-h-0 divide-y divide-border overflow-y-auto rounded-xl border border-border"
        >
          {visibleSpecies.map((species) => (
            <OwnSpeciesRow
              key={species.id}
              menuTriggerRef={species.id === returnFocusTo ? returnFocusRef : undefined}
              onDelete={() => onDelete(species)}
              onMerge={() => onMerge(species)}
              onRename={() => onRename(species)}
              species={species}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyNotice({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
