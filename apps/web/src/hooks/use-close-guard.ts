"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { z } from "zod";

const HISTORY_SENTINEL = {
  entryKeyStorageKey: "closeGuard:entryKey",
  key: "closeGuard",
} as const;

const historyStateSchema = z.record(z.string(), z.unknown()).catch({});

export type CloseGuardDraft = {
  isDirty: boolean;
  isPending: boolean;
};

export const CLEAN_CLOSE_GUARD_DRAFT: CloseGuardDraft = { isDirty: false, isPending: false };

type CloseGuard = {
  close: () => void;
  discardDialog: {
    onCloseAutoFocus: (event: Event) => void;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  };
  requestClose: () => void;
};

type CloseGuardOptions = CloseGuardDraft & {
  focusFallback: () => void;
  guardHistory?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onLeave?: () => void;
};

type DiscardReason = "close" | "history";

type Exit = Nullable<() => void>;

export function useCloseGuard({
  focusFallback,
  guardHistory = false,
  isDirty,
  isOpen,
  isPending,
  onClose,
  onLeave,
}: CloseGuardOptions): CloseGuard {
  const [discardReason, setDiscardReason] = useState<Nullable<DiscardReason>>(null);
  const focusBeforePromptRef = useRef<Nullable<HTMLElement>>(null);
  const isDraftDiscardedRef = useRef(false);
  const isSentinelCurrentRef = useRef(false);
  const isHistoryArmedRef = useRef(false);
  const exitAfterReleaseRef = useRef<Exit>(null);
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
    const previous = focusBeforePromptRef.current;
    focusBeforePromptRef.current = null;
    if (isDraftDiscardedRef.current) return;
    if (previous?.isConnected) {
      previous.focus();
      return;
    }
    focusFallback();
  }

  function finishClose(exit: Exit) {
    const waitsForHistoryRelease = isHistoryArmedRef.current;
    exitAfterReleaseRef.current = waitsForHistoryRelease ? exit : null;
    onClose();
    if (!waitsForHistoryRelease) exit?.();
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

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isGuarding]);

  useEffect(() => {
    if (!guardHistory || !isGuarding) return;

    function interceptHistoryLeave() {
      isSentinelCurrentRef.current = hasHistorySentinel();
      if (isSentinelCurrentRef.current) return;
      confirmHistoryLeave();
    }

    pushHistorySentinel();
    isSentinelCurrentRef.current = true;
    isHistoryArmedRef.current = true;
    window.addEventListener("popstate", interceptHistoryLeave);

    return () => {
      window.removeEventListener("popstate", interceptHistoryLeave);
      isHistoryArmedRef.current = false;
      const exit = exitAfterReleaseRef.current;
      exitAfterReleaseRef.current = null;
      const isSentinelCurrent = isSentinelCurrentRef.current && hasHistorySentinel();
      isSentinelCurrentRef.current = false;

      if (!isSentinelCurrent) {
        exit?.();
        return;
      }

      if (exit !== null) window.addEventListener("popstate", () => exit(), { once: true });
      window.history.back();
    };
  }, [guardHistory, isGuarding]);

  return {
    close: () => finishClose(onLeave ?? null),
    discardDialog: {
      onCloseAutoFocus: returnFocusToDraft,
      onConfirm: () => {
        const exit: Exit =
          discardReason === "history" ? () => window.history.back() : (onLeave ?? null);
        isDraftDiscardedRef.current = true;
        setDiscardReason(null);
        finishClose(exit);
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
      finishClose(onLeave ?? null);
    },
  };
}

export function useReleaseOrphanedHistorySentinel() {
  const isReleasedRef = useRef(false);

  useEffect(() => {
    if (isReleasedRef.current || !hasHistorySentinel()) return;
    isReleasedRef.current = true;
    window.history.back();
  }, []);
}

function currentHistoryEntryKey(): Nullable<string> {
  if (!("navigation" in window)) return null;
  return window.navigation.currentEntry?.key ?? null;
}

function hasHistorySentinel(): boolean {
  if (historyStateSchema.parse(window.history.state)[HISTORY_SENTINEL.key] === true) return true;
  const entryKey = currentHistoryEntryKey();
  return entryKey !== null && entryKey === readSentinelEntryKey();
}

function pushHistorySentinel() {
  window.history.pushState(
    { ...historyStateSchema.parse(window.history.state), [HISTORY_SENTINEL.key]: true },
    "",
  );
  rememberSentinelEntryKey();
}

function readSentinelEntryKey(): Nullable<string> {
  try {
    return window.sessionStorage.getItem(HISTORY_SENTINEL.entryKeyStorageKey);
  } catch {
    return null;
  }
}

function rememberSentinelEntryKey() {
  const entryKey = currentHistoryEntryKey();
  if (entryKey === null) return;
  try {
    window.sessionStorage.setItem(HISTORY_SENTINEL.entryKeyStorageKey, entryKey);
  } catch {
    return;
  }
}
