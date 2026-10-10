"use client";

import type { Nullable, OwnSpeciesView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useOwnSpecies } from "../api/use-own-species";
import { OwnSpeciesUsage } from "./own-species-usage";

export type OwnSpeciesAction = {
  kind: "delete" | "merge" | "rename";
  speciesId: string;
};

type OwnSpeciesListProps = {
  onDelete: (species: OwnSpeciesView) => void;
  onMerge: (species: OwnSpeciesView) => void;
  onRename: (species: OwnSpeciesView) => void;
  returnFocusTo: Nullable<OwnSpeciesAction>;
};

const LIST_SKELETON_ROWS = 3;

export function OwnSpeciesList({
  onDelete,
  onMerge,
  onRename,
  returnFocusTo,
}: OwnSpeciesListProps) {
  const t = useTranslations("species.manage");
  const ownSpecies = useOwnSpecies();
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const isListed = ownSpecies.isSuccess;

  useEffect(() => {
    returnFocusRef.current?.focus();
  }, [isListed]);

  const returnFocusRefFor = (species: OwnSpeciesView, kind: OwnSpeciesAction["kind"]) =>
    returnFocusTo?.speciesId === species.id && returnFocusTo.kind === kind
      ? returnFocusRef
      : undefined;

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
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul
      aria-label={t("listLabel")}
      className="flex flex-col divide-y divide-border rounded-xl border border-border"
    >
      {ownSpecies.data.map((species) => (
        <li
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3"
          key={species.id}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium break-words text-foreground">{species.name}</span>
            <span className="text-xs text-muted-foreground">
              <OwnSpeciesUsage usage={species.usage} />
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button
              aria-label={t("renameAction", { name: species.name })}
              onClick={() => onRename(species)}
              ref={returnFocusRefFor(species, "rename")}
              size="xs"
              type="button"
              variant="ghost"
            >
              <UiIcon name="edit" size={12} />
              {t("rename")}
            </Button>
            <Button
              aria-label={t("mergeAction", { name: species.name })}
              onClick={() => onMerge(species)}
              ref={returnFocusRefFor(species, "merge")}
              size="xs"
              type="button"
              variant="ghost"
            >
              <UiIcon name="swap" size={12} />
              {t("merge")}
            </Button>
            <Button
              aria-label={t("deleteAction", { name: species.name })}
              className="text-error hover:text-error"
              onClick={() => onDelete(species)}
              ref={returnFocusRefFor(species, "delete")}
              size="xs"
              type="button"
              variant="ghost"
            >
              <UiIcon name="trash" size={12} />
              {t("delete")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
