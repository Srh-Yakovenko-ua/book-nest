"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { NoteEntityRef } from "../model/note-entity";

import { NoteEntityPicker } from "./note-entity-picker";
import { NoteFormDialog } from "./note-form-dialog";

type NotesArchiveCreateFlowProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function NotesArchiveCreateFlow({ onOpenChange, open }: NotesArchiveCreateFlowProps) {
  const t = useTranslations("notes.archive.picker");
  const [entity, setEntity] = useState<Nullable<NoteEntityRef>>(null);

  const isPickerOpen = open && entity === null;

  function closeFlow() {
    setEntity(null);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        onOpenChange={(next) => (next ? onOpenChange(true) : closeFlow())}
        open={isPickerOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {isPickerOpen ? <NoteEntityPicker onSelect={setEntity} /> : null}
        </DialogContent>
      </Dialog>

      {entity === null ? null : (
        <NoteFormDialog
          entity={entity}
          onOpenChange={(next) => {
            if (!next) closeFlow();
          }}
          open
        />
      )}
    </>
  );
}
