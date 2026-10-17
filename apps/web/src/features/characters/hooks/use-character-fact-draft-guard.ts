"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { z } from "zod";

const DRAFT_GUARD = {
  historyKey: "characterFactDraftGuard",
} as const;

const historyStateSchema = z.record(z.string(), z.unknown()).catch({});

type CharacterFactDraftGuard = {
  discardDialog: {
    onCloseAutoFocus: (event: Event) => void;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  };
  requestClose: () => void;
};

type CharacterFactDraftGuardOptions = {
  focusFirstField: () => void;
  isDirty: boolean;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
};

type DiscardReason = "close" | "history";

export function useCharacterFactDraftGuard({
  focusFirstField,
  isDirty,
  isOpen,
  isPending,
  onClose,
}: CharacterFactDraftGuardOptions): CharacterFactDraftGuard {
  const [discardReason, setDiscardReason] = useState<Nullable<DiscardReason>>(null);
  const isSentinelCurrentRef = useRef(false);
  const leavesAfterCloseRef = useRef(false);
  const focusBeforePromptRef = useRef<Nullable<HTMLElement>>(null);
  const isDraftDiscardedRef = useRef(false);
  const isGuarding = isOpen && isDirty;

  function openPrompt(reason: DiscardReason) {
    setDiscardReason(reason);
    isDraftDiscardedRef.current = false;
    if (focusBeforePromptRef.current !== null) return;
    const focused = document.activeElement;
    focusBeforePromptRef.current =
      focused instanceof HTMLElement && focused !== document.body ? focused : null;
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
    focusFirstField();
  }

  const confirmHistoryLeave = useEffectEvent(() => {
    pushHistorySentinel();
    isSentinelCurrentRef.current = true;
    if (!isPending) openPrompt("history");
  });

  useEffect(() => {
    if (!isGuarding) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function interceptHistoryLeave() {
      isSentinelCurrentRef.current = hasHistorySentinel();
      if (isSentinelCurrentRef.current) return;
      confirmHistoryLeave();
    }

    pushHistorySentinel();
    isSentinelCurrentRef.current = true;
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", interceptHistoryLeave);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", interceptHistoryLeave);
      const leavesAfterClose = leavesAfterCloseRef.current;
      leavesAfterCloseRef.current = false;

      if (!isSentinelCurrentRef.current) {
        if (leavesAfterClose) window.history.back();
        return;
      }

      isSentinelCurrentRef.current = false;
      if (leavesAfterClose) {
        window.addEventListener("popstate", () => window.history.back(), { once: true });
      }
      window.history.back();
    };
  }, [isGuarding]);

  return {
    discardDialog: {
      onCloseAutoFocus: returnFocusToDraft,
      onConfirm: () => {
        leavesAfterCloseRef.current = discardReason === "history";
        isDraftDiscardedRef.current = true;
        setDiscardReason(null);
        onClose();
      },
      onOpenChange: (open) => {
        if (!open) setDiscardReason(null);
      },
      open: discardReason !== null,
    },
    requestClose: () => {
      if (isPending) return;
      if (isDirty) {
        openPrompt("close");
        return;
      }
      onClose();
    },
  };
}

export function useReleaseOrphanedDraftSentinel() {
  const isReleasedRef = useRef(false);

  useEffect(() => {
    if (isReleasedRef.current || !hasHistorySentinel()) return;
    isReleasedRef.current = true;
    window.history.back();
  }, []);
}

function hasHistorySentinel(): boolean {
  return historyStateSchema.parse(window.history.state)[DRAFT_GUARD.historyKey] === true;
}

function pushHistorySentinel() {
  window.history.pushState(
    { ...historyStateSchema.parse(window.history.state), [DRAFT_GUARD.historyKey]: true },
    "",
  );
}
