"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useState } from "react";

import type {
  RelationshipAuthoringContext,
  RelationshipEditorTarget,
} from "../model/relationship-authoring";

import { DeleteRelationshipDialog } from "./delete-relationship-dialog";
import { RelationshipEditorDialog } from "./relationship-editor-dialog";

export type RelationshipAuthoring = {
  actions: RelationshipAuthoringActions;
  dialogs: ReactNode;
};

export type RelationshipAuthoringActions = {
  onCreate: () => void;
  onDelete: (relationshipId: string) => void;
  onEdit: (relationshipId: string) => void;
};

type AuthoringDialog =
  | { kind: "delete"; open: boolean; relationshipId: string; session: number }
  | { kind: "editor"; open: boolean; session: number; target: RelationshipEditorTarget };

type AuthoringDialogRequest =
  { kind: "delete"; relationshipId: string } | { kind: "editor"; target: RelationshipEditorTarget };

export function useRelationshipAuthoring(
  context: RelationshipAuthoringContext,
): RelationshipAuthoring {
  const [dialog, setDialog] = useState<Nullable<AuthoringDialog>>(null);

  function openDialog(request: AuthoringDialogRequest) {
    setDialog((current) => ({ ...request, open: true, session: (current?.session ?? 0) + 1 }));
  }

  function closeDialog() {
    setDialog((current) => (current === null ? null : { ...current, open: false }));
  }

  const actions: RelationshipAuthoringActions = {
    onCreate: () => openDialog({ kind: "editor", target: { mode: "create" } }),
    onDelete: (relationshipId) => openDialog({ kind: "delete", relationshipId }),
    onEdit: (relationshipId) =>
      openDialog({ kind: "editor", target: { mode: "edit", relationshipId } }),
  };

  return { actions, dialogs: renderDialog({ closeDialog, context, dialog }) };
}

function renderDialog({
  closeDialog,
  context,
  dialog,
}: {
  closeDialog: () => void;
  context: RelationshipAuthoringContext;
  dialog: Nullable<AuthoringDialog>;
}): ReactNode {
  if (dialog === null) return null;
  if (dialog.kind === "delete") {
    return (
      <DeleteRelationshipDialog
        key={dialog.session}
        onClose={closeDialog}
        open={dialog.open}
        relationshipId={dialog.relationshipId}
      />
    );
  }
  return (
    <RelationshipEditorDialog
      {...context}
      key={dialog.session}
      onClose={closeDialog}
      open={dialog.open}
      target={dialog.target}
    />
  );
}
