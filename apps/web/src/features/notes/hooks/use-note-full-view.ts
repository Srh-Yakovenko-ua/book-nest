"use client";

import type { NoteView, Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useRef, useState } from "react";

export type OpenNoteFullView = (note: NoteView, trigger: HTMLButtonElement) => void;

type NoteFullView = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openFrom: (trigger: HTMLButtonElement) => void;
  triggerRef: RefObject<Nullable<HTMLButtonElement>>;
};

export function useNoteFullView(): NoteFullView {
  const triggerRef = useRef<Nullable<HTMLButtonElement>>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openFrom = (trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setIsOpen(true);
  };

  return { isOpen, onOpenChange: setIsOpen, openFrom, triggerRef };
}

export function useSelectedNoteFullView(): NoteFullView & {
  note: Nullable<NoteView>;
  open: OpenNoteFullView;
} {
  const fullView = useNoteFullView();
  const [note, setNote] = useState<Nullable<NoteView>>(null);

  return {
    ...fullView,
    note,
    open: (selected, trigger) => {
      setNote(selected);
      fullView.openFrom(trigger);
    },
  };
}
