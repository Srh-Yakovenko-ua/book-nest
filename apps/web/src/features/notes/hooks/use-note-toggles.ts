"use client";

import type { NoteView, UpdateNoteInput } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { useUpdateNote } from "../api/use-update-note";

type NoteToggles = {
  isPending: boolean;
  toggleFavorite: () => void;
  togglePin: () => void;
};

export function useNoteToggles(note: NoteView): NoteToggles {
  const t = useTranslations("notes.toast");
  const updateNote = useUpdateNote();
  const isSavingRef = useRef(false);

  async function toggle(input: UpdateNoteInput, successMessage: string) {
    if (updateNote.isPending || isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await updateNote.mutateAsync({ input, noteId: note.id });
      toast.success(successMessage);
    } catch {
      toast.error(t("updateError"));
    } finally {
      isSavingRef.current = false;
    }
  }

  function toggleFavorite() {
    const isFavorite = !note.isFavorite;
    void toggle({ isFavorite }, t(isFavorite ? "favorited" : "unfavorited"));
  }

  function togglePin() {
    const isPinned = !note.isPinned;
    void toggle({ isPinned }, t(isPinned ? "pinned" : "unpinned"));
  }

  return { isPending: updateNote.isPending, toggleFavorite, togglePin };
}
