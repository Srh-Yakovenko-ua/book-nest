"use client";

import type { Nullable, OwnSpeciesView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { assertNever } from "@/lib/assert-never";

import type { OwnSpeciesChange } from "../model/own-species-change";
import type { OwnSpeciesFilters } from "../model/own-species-filters";
import type { SpeciesSelection } from "../model/species-selection";

import { OWN_SPECIES_FILTERS } from "../model/own-species-filters";
import { DeleteOwnSpeciesPanel } from "./delete-own-species-panel";
import { MergeOwnSpeciesPanel } from "./merge-own-species-panel";
import { OwnSpeciesList } from "./own-species-list";
import { RenameOwnSpeciesPanel } from "./rename-own-species-panel";

type ManageOwnSpeciesDialogProps = {
  onChange: (change: OwnSpeciesChange) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  trigger: ReactNode;
};

type ManageView =
  | { kind: "delete"; species: OwnSpeciesView }
  | { kind: "list"; returnFocusTo: Nullable<string> }
  | { kind: "merge"; species: OwnSpeciesView; target: Nullable<SpeciesSelection> }
  | { kind: "rename"; species: OwnSpeciesView };

const LIST_VIEW = { kind: "list", returnFocusTo: null } as const satisfies ManageView;

export function ManageOwnSpeciesDialog({
  onChange,
  onOpenChange,
  open,
  trigger,
}: ManageOwnSpeciesDialogProps) {
  const t = useTranslations("species.manage");
  const [view, setView] = useState<ManageView>(LIST_VIEW);
  const [filters, setFilters] = useState<OwnSpeciesFilters>(OWN_SPECIES_FILTERS.none);
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function changeOpen(next: boolean) {
    if (busy) return;
    if (!next) {
      setView(LIST_VIEW);
      setFilters(OWN_SPECIES_FILTERS.none);
    }
    onOpenChange(next);
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        ref={contentRef}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <ManageViewBody
            busy={busy}
            filters={filters}
            onBusyChange={setBusy}
            onChange={onChange}
            onFiltersChange={setFilters}
            onViewChange={setView}
            view={view}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ManageViewBody({
  busy,
  filters,
  onBusyChange,
  onChange,
  onFiltersChange,
  onViewChange,
  view,
}: {
  busy: boolean;
  filters: OwnSpeciesFilters;
  onBusyChange: (busy: boolean) => void;
  onChange: (change: OwnSpeciesChange) => void;
  onFiltersChange: (filters: OwnSpeciesFilters) => void;
  onViewChange: (view: ManageView) => void;
  view: ManageView;
}) {
  const returnToList = (speciesId: string) =>
    onViewChange({ kind: "list", returnFocusTo: speciesId });
  const mergeInto = (species: OwnSpeciesView, target: Nullable<SpeciesSelection>) =>
    onViewChange({ kind: "merge", species, target });

  switch (view.kind) {
    case "delete":
      return (
        <DeleteOwnSpeciesPanel
          busy={busy}
          key={view.species.id}
          onBack={() => returnToList(view.species.id)}
          onBusyChange={onBusyChange}
          onDeleted={() => {
            onChange({ kind: "deleted", speciesId: view.species.id });
            returnToList(view.species.id);
          }}
          onMergeInstead={() => mergeInto(view.species, null)}
          species={view.species}
        />
      );
    case "list":
      return (
        <OwnSpeciesList
          filters={filters}
          onDelete={(species) => onViewChange({ kind: "delete", species })}
          onFiltersChange={onFiltersChange}
          onMerge={(species) => mergeInto(species, null)}
          onRename={(species) => onViewChange({ kind: "rename", species })}
          returnFocusTo={view.returnFocusTo}
        />
      );
    case "merge":
      return (
        <MergeOwnSpeciesPanel
          busy={busy}
          initialTarget={view.target}
          key={view.species.id}
          onBack={() => returnToList(view.species.id)}
          onBusyChange={onBusyChange}
          onMerged={(target) => {
            onChange({ kind: "merged", sourceId: view.species.id, target });
            returnToList(view.species.id);
          }}
          species={view.species}
        />
      );
    case "rename":
      return (
        <RenameOwnSpeciesPanel
          key={view.species.id}
          onBack={() => returnToList(view.species.id)}
          onMergeInto={(target) => mergeInto(view.species, target)}
          onRenamed={(species) => {
            onChange({ kind: "renamed", species });
            returnToList(species.id);
          }}
          species={view.species}
        />
      );
    default:
      return assertNever(view);
  }
}
