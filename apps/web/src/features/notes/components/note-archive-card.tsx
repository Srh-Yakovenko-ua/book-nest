"use client";

import type { NoteView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { NoteCardLayout } from "./note-card-layout";

import { useDeleteNote } from "../api/use-delete-note";
import { useNoteFullView } from "../hooks/use-note-full-view";
import { useNoteToggles } from "../hooks/use-note-toggles";
import { noteCategoryLabel } from "../model/note-category-label";
import { noteEntityRefFromNote } from "../model/note-entity";
import { DeleteNoteDialog } from "./delete-note-dialog";
import { NoteActionsMenu } from "./note-actions-menu";
import { NOTE_CARD_LAYOUT } from "./note-card-layout";
import { NoteEntityHeader } from "./note-entity-header";
import { NoteEntityLocation } from "./note-entity-location";
import { NoteFormDialog } from "./note-form-dialog";
import { NoteFullViewDialog } from "./note-full-view-dialog";
import { NotePreview } from "./note-preview";
import { NoteSpoilerGate } from "./note-spoiler-gate";

type NoteArchiveCardProps = {
  layout: NoteCardLayout;
  note: NoteView;
};

export function NoteArchiveCard({ layout, note }: NoteArchiveCardProps) {
  const t = useTranslations("notes");
  const tCategories = useTranslations("notes.categories");
  const [card, setCard] = useState<Nullable<HTMLElement>>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  const toggles = useNoteToggles(note);
  const deleteNote = useDeleteNote();
  const fullView = useNoteFullView();

  const entity = noteEntityRefFromNote(note);
  const hasEntityHeader = layout !== "embedded" && entity !== null;
  const category = noteCategoryLabel(note, (value) => tCategories(value));

  async function onConfirmDelete() {
    if (deleteNote.isPending) return;
    try {
      await deleteNote.mutateAsync(note);
      toast.success(t("toast.deleted"));
      setDeleteOpen(false);
    } catch {
      toast.error(t("toast.deleteError"));
    }
  }

  const cardActions = (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        aria-disabled={toggles.isPending}
        aria-label={t("actions.favorite")}
        aria-pressed={note.isFavorite}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={toggles.toggleFavorite}
        size="icon-sm"
        variant="ghost"
      >
        <UiIcon
          className={note.isFavorite ? "text-favorite" : "text-muted-foreground"}
          name={note.isFavorite ? "heart-fill" : "heart"}
          size={16}
        />
      </Button>
      <NoteActionsMenu
        onDelete={() => setDeleteOpen(true)}
        onEdit={entity === null ? null : () => setEditOpen(true)}
      />
    </div>
  );

  const pinToggle = (
    <Button
      aria-disabled={toggles.isPending}
      aria-label={t("actions.pin")}
      aria-pressed={note.isPinned}
      className="ml-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={toggles.togglePin}
      size="icon-sm"
      variant="ghost"
    >
      <UiIcon
        className={note.isPinned ? "text-primary" : "text-muted-foreground"}
        fill={note.isPinned ? "currentColor" : "none"}
        name="bookmark"
        size={16}
      />
    </Button>
  );

  const categoryChip =
    category === null ? null : (
      <Badge
        className="block max-w-full min-w-0 shrink truncate"
        title={category}
        variant="secondary"
      >
        {category}
      </Badge>
    );

  return (
    <article className={NOTE_CARD_LAYOUT[layout].shell} ref={setCard}>
      {hasEntityHeader ? (
        <>
          <div className="flex shrink-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <NoteEntityHeader entity={entity} placement="card" />
            </div>
            {cardActions}
          </div>
          <div className="flex min-h-8 shrink-0 items-center gap-2">
            {categoryChip}
            {pinToggle}
          </div>
        </>
      ) : (
        <div className="flex min-h-8 shrink-0 items-center gap-2">
          {categoryChip}
          {pinToggle}
          {cardActions}
        </div>
      )}

      {note.isSpoiler ? (
        <NoteSpoilerGate entityType={note.entityType} layout={layout} onOpen={fullView.openFrom} />
      ) : (
        <NotePreview card={card} layout={layout} onExpand={fullView.openFrom} text={note.text} />
      )}

      <NoteEntityLocation note={note} placement="card" />

      <NoteFullViewDialog
        note={note}
        onOpenChange={fullView.onOpenChange}
        open={fullView.isOpen}
        triggerRef={fullView.triggerRef}
      />

      {entity === null ? null : (
        <NoteFormDialog
          onOpenChange={setEditOpen}
          open={isEditOpen}
          target={{ entity, mode: "edit", note }}
        />
      )}

      <DeleteNoteDialog
        isDeleting={deleteNote.isPending}
        onConfirm={() => void onConfirmDelete()}
        onOpenChange={(open) => {
          if (!open && !deleteNote.isPending) setDeleteOpen(false);
        }}
        open={isDeleteOpen}
      />
    </article>
  );
}
