"use client";

import type { CharacterRelationshipDetailsView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { RelationshipFormValues } from "./relationship-form-schema";

import { useUpdateRelationship } from "../api/use-update-relationship";
import { useUpsertRelationshipBookState } from "../api/use-upsert-relationship-book-state";
import {
  toRelationshipBookStateChange,
  toUpdateRelationshipInput,
} from "./relationship-form-input";
import { toRelationshipSaveError } from "./relationship-save-error";

type EdgeSaveResult =
  | { edge: CharacterRelationshipDetailsView; kind: "saved" }
  | { kind: "failed" }
  | { kind: "untouched" };

type RelationshipEditSaveOptions = {
  onEdgeSaved: () => void;
  onSaved: () => void;
  relationship: CharacterRelationshipDetailsView;
  reportSaveError: (error: unknown) => void;
};

type SaveOptions = {
  allowFamilyCycle: boolean;
};

export function useRelationshipEditSave({
  onEdgeSaved,
  onSaved,
  relationship,
  reportSaveError,
}: RelationshipEditSaveOptions) {
  const tToast = useTranslations("relationships.toast");
  const updateRelationship = useUpdateRelationship();
  const upsertBookState = useUpsertRelationshipBookState();
  const [savedEdge, setSavedEdge] = useState<Nullable<CharacterRelationshipDetailsView>>(null);

  async function saveEdge({
    allowFamilyCycle,
    values,
  }: SaveOptions & { values: RelationshipFormValues }): Promise<EdgeSaveResult> {
    try {
      const update = toUpdateRelationshipInput({
        allowFamilyCycle,
        relationship: savedEdge ?? relationship,
        values,
      });
      if (update === null) {
        return savedEdge === null ? { kind: "untouched" } : { edge: savedEdge, kind: "saved" };
      }
      const edge = await updateRelationship.mutateAsync({
        input: update,
        relationshipId: relationship.id,
      });
      onEdgeSaved();
      return { edge, kind: "saved" };
    } catch (error) {
      reportSaveError(error);
      return { kind: "failed" };
    }
  }

  function reportBookStateError({ edgeSave, error }: { edgeSave: EdgeSaveResult; error: unknown }) {
    if (edgeSave.kind !== "saved") {
      reportSaveError(error);
      return;
    }
    setSavedEdge(edgeSave.edge);
    if (toRelationshipSaveError(error).kind !== "unknown") reportSaveError(error);
  }

  async function save(values: RelationshipFormValues, { allowFamilyCycle }: SaveOptions) {
    const edgeSave = await saveEdge({ allowFamilyCycle, values });
    if (edgeSave.kind === "failed") return;
    try {
      const bookStateChange = toRelationshipBookStateChange({ relationship, values });
      if (bookStateChange !== null) {
        await upsertBookState.mutateAsync({ ...bookStateChange, relationshipId: relationship.id });
      }
    } catch (error) {
      reportBookStateError({ edgeSave, error });
      return;
    }
    toast.success(tToast("updated"));
    onSaved();
  }

  return { isPartiallySaved: savedEdge !== null, save };
}
