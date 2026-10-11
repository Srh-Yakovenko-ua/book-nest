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
import type { SpeciesSelection } from "../model/species-selection";
import type { OwnSpeciesAction } from "./own-species-list";

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
  | { kind: "list"; returnFocusTo: Nullable<OwnSpeciesAction> }
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
  const contentRef = useRef<HTMLDivElement>(null);

  function changeOpen(next: boolean) {
    if (!next) setView(LIST_VIEW);
    onOpenChange(next);
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        ref={contentRef}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? <ManageViewBody onChange={onChange} onViewChange={setView} view={view} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ManageViewBody({
  onChange,
  onViewChange,
  view,
}: {
  onChange: (change: OwnSpeciesChange) => void;
  onViewChange: (view: ManageView) => void;
  view: ManageView;
}) {
  const returnToList = (action: OwnSpeciesAction) =>
    onViewChange({ kind: "list", returnFocusTo: action });
  const mergeInto = (species: OwnSpeciesView, target: Nullable<SpeciesSelection>) =>
    onViewChange({ kind: "merge", species, target });

  switch (view.kind) {
    case "delete":
      return (
        <DeleteOwnSpeciesPanel
          key={view.species.id}
          onBack={() => returnToList({ kind: "delete", speciesId: view.species.id })}
          onDeleted={() => {
            onChange({ kind: "deleted", speciesId: view.species.id });
            onViewChange(LIST_VIEW);
          }}
          onMergeInstead={() => mergeInto(view.species, null)}
          species={view.species}
        />
      );
    case "list":
      return (
        <OwnSpeciesList
          onDelete={(species) => onViewChange({ kind: "delete", species })}
          onMerge={(species) => mergeInto(species, null)}
          onRename={(species) => onViewChange({ kind: "rename", species })}
          returnFocusTo={view.returnFocusTo}
        />
      );
    case "merge":
      return (
        <MergeOwnSpeciesPanel
          initialTarget={view.target}
          key={view.species.id}
          onBack={() => returnToList({ kind: "merge", speciesId: view.species.id })}
          onMerged={(target) => {
            onChange({ kind: "merged", sourceId: view.species.id, target });
            onViewChange(LIST_VIEW);
          }}
          species={view.species}
        />
      );
    case "rename":
      return (
        <RenameOwnSpeciesPanel
          key={view.species.id}
          onBack={() => returnToList({ kind: "rename", speciesId: view.species.id })}
          onMergeInto={(target) => mergeInto(view.species, target)}
          onRenamed={(species) => {
            onChange({ kind: "renamed", species });
            returnToList({ kind: "rename", speciesId: species.id });
          }}
          species={view.species}
        />
      );
    default:
      return assertNever(view);
  }
}
