"use client";

import type { Nullable } from "@app/shared";

import { useEffect } from "react";

import { useAuthStore } from "@/features/auth";

import { clearBookFormDraftsNotOwnedBy, clearLegacyBookFormDrafts } from "../model/book-form-draft";

export function useClearBookFormDraftsOnUserChange() {
  useEffect(() => {
    const { status, user } = useAuthStore.getState();
    if (status !== "loading") clearDraftsForeignTo(user?.id ?? null);

    return useAuthStore.subscribe((state, previous) => {
      if (state.status === "loading") return;
      const readerId = state.user?.id ?? null;
      if (readerId !== null && readerId === previous.user?.id) return;
      clearDraftsForeignTo(readerId);
    });
  }, []);
}

function clearDraftsForeignTo(readerId: Nullable<string>) {
  if (readerId === null) {
    clearLegacyBookFormDrafts();
    return;
  }
  clearBookFormDraftsNotOwnedBy(readerId);
}
