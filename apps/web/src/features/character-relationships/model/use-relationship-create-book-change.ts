"use client";

import type { Nullable } from "@app/shared";
import type { UseFormReturn } from "react-hook-form";

import { useState } from "react";

import type { RelationshipFormInput, RelationshipFormValues } from "./relationship-form-schema";

import { bookStateChangedFromDefaults } from "./relationship-book-state-changes";
import { keepFocusParticipant } from "./relationship-create-step";
import { relationshipBookStateDefaults } from "./relationship-form-input";

type UseRelationshipCreateBookChangeArgs = {
  focusCharacterId: Nullable<string>;
  form: UseFormReturn<RelationshipFormInput, unknown, RelationshipFormValues>;
  onBookChanged: () => void;
};

export function useRelationshipCreateBookChange({
  focusCharacterId,
  form,
  onBookChanged,
}: UseRelationshipCreateBookChangeArgs) {
  const [pendingBookId, setPendingBookId] = useState<Nullable<string>>(null);
  const { clearErrors, getValues, setFocus, setValue } = form;

  function applyBookChange(nextBookId: string) {
    const [currentSource, currentTarget] = getValues(["source", "target"]);
    setValue("bookId", nextBookId, { shouldDirty: true });
    setValue(
      "source",
      keepFocusParticipant({ focusId: focusCharacterId, participant: currentSource }),
      { shouldDirty: true },
    );
    setValue(
      "target",
      keepFocusParticipant({ focusId: focusCharacterId, participant: currentTarget }),
      { shouldDirty: true },
    );
    setValue("bookState", relationshipBookStateDefaults(null), { shouldDirty: true });
    clearErrors(["bookId", "source", "target", "bookState"]);
    clearErrors("root");
    onBookChanged();
  }

  return {
    dialog: {
      onCancel: () => setPendingBookId(null),
      onCloseAutoFocus: (event: Event) => {
        event.preventDefault();
        setFocus("bookId");
      },
      onConfirm: () => {
        if (pendingBookId !== null) applyBookChange(pendingBookId);
        setPendingBookId(null);
      },
      open: pendingBookId !== null,
    },
    requestBookChange: (nextBookId: Nullable<string>) => {
      if (nextBookId === null || nextBookId === getValues("bookId")) return;
      if (bookStateChangedFromDefaults(getValues("bookState"))) {
        setPendingBookId(nextBookId);
        return;
      }
      applyBookChange(nextBookId);
    },
  };
}
