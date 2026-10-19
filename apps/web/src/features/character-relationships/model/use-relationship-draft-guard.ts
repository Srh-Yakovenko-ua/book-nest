"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useRef, useState } from "react";

import type { RelationshipDraftState } from "./relationship-authoring";

type RelationshipDraftGuardOptions = RelationshipDraftState & {
  focusDraft: () => void;
  isOpen: boolean;
  onClose: () => void;
};

export function useRelationshipDraftGuard({
  focusDraft,
  isDirty,
  isOpen,
  isPending,
  onClose,
}: RelationshipDraftGuardOptions) {
  const [isPromptOpen, setPromptOpen] = useState(false);
  const focusBeforePromptRef = useRef<Nullable<HTMLElement>>(null);
  const isDraftDiscardedRef = useRef(false);
  const isGuarding = isOpen && isDirty;

  useEffect(() => {
    if (!isGuarding) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isGuarding]);

  function openPrompt() {
    const focused = document.activeElement;
    focusBeforePromptRef.current =
      focused instanceof HTMLElement && focused !== document.body ? focused : null;
    isDraftDiscardedRef.current = false;
    setPromptOpen(true);
  }

  function returnFocusToDraft(event: Event) {
    event.preventDefault();
    if (isDraftDiscardedRef.current) return;
    const previous = focusBeforePromptRef.current;
    focusBeforePromptRef.current = null;
    if (previous?.isConnected) {
      previous.focus();
      return;
    }
    focusDraft();
  }

  return {
    discardDialog: {
      onCloseAutoFocus: returnFocusToDraft,
      onConfirm: () => {
        isDraftDiscardedRef.current = true;
        setPromptOpen(false);
        onClose();
      },
      onOpenChange: (open: boolean) => {
        if (!open) setPromptOpen(false);
      },
      open: isPromptOpen,
    },
    requestClose: () => {
      if (isPending) return;
      if (isDirty) {
        openPrompt();
        return;
      }
      onClose();
    },
  };
}
