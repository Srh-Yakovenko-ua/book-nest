"use client";

import { useClearBookFormDraftsOnUserChange } from "../hooks/use-clear-book-form-drafts-on-user-change";

export function BookFormDraftCleanup() {
  useClearBookFormDraftsOnUserChange();

  return null;
}
