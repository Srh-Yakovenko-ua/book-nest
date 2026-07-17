"use client";

import type { NoteCategory, NoteView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useDeleteNote } from "../api/use-delete-note";
import { useUpdateNote } from "../api/use-update-note";
import { NOTE_CUSTOM_CATEGORY } from "../model/note-categories";
import { noteEntityHref, noteEntityRefFromNote } from "../model/note-entity";
import { noteLocationLine } from "../model/note-location";
import { DeleteNoteDialog } from "./delete-note-dialog";
import { NoteActionsMenu } from "./note-actions-menu";
import { NoteEntityPreview } from "./note-entity-preview";
import { NoteFormDialog } from "./note-form-dialog";

const CLAMP_TEXT_LENGTH = 320;
const CLAMP_TEXT_LINES = 5;

type NoteCardProps = {
  note: NoteView;
  showEntity?: boolean;
};

export function NoteCard({ note, showEntity = false }: NoteCardProps) {
  const t = useTranslations("notes");
  const tCategories = useTranslations("notes.categories");
  const locale = useLocale();

  const [isSpoilerRevealed, setSpoilerRevealed] = useState(false);
  const [isTextExpanded, setTextExpanded] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const entity = noteEntityRefFromNote(note);
  const categoryChip = noteCategoryChip(note, {
    custom: (value) => tCategories("custom", { value }),
    label: (value) => tCategories(value),
  });
  const location = noteLocationLine(note, (page) => t("card.page", { page }));
  const isTextHidden = note.isSpoiler && !isSpoilerRevealed;
  const isClampable = isLongText(note.text);
  const isEdited = note.updatedAt !== note.createdAt;

  function onToggleFavorite() {
    const isFavorite = !note.isFavorite;
    updateNote.mutate(
      { input: { isFavorite }, noteId: note.id },
      {
        onError: () => toast.error(t("toast.updateError")),
        onSuccess: () => toast.success(t(isFavorite ? "toast.favorited" : "toast.unfavorited")),
      },
    );
  }

  function onTogglePin() {
    const isPinned = !note.isPinned;
    updateNote.mutate(
      { input: { isPinned }, noteId: note.id },
      {
        onError: () => toast.error(t("toast.updateError")),
        onSuccess: () => toast.success(t(isPinned ? "toast.pinned" : "toast.unpinned")),
      },
    );
  }

  function onConfirmDelete() {
    deleteNote.mutate(note.id, {
      onError: () => toast.error(t("toast.deleteError")),
      onSuccess: () => {
        toast.success(t("toast.deleted"));
        setDeleteOpen(false);
      },
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {showEntity && entity !== null ? <NoteEntityPreview entity={entity} /> : null}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {note.isPinned ? (
            <Badge variant="primary">
              <UiIcon name="bookmark" size={12} />
              {t("card.pinned")}
            </Badge>
          ) : null}
          {categoryChip === null ? null : <Badge variant="secondary">{categoryChip}</Badge>}
          {note.isSpoiler ? (
            <Badge variant="warning">
              <UiIcon name="eye-off" size={12} />
              {t("card.spoiler")}
            </Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            aria-label={t(note.isFavorite ? "actions.unfavorite" : "actions.favorite")}
            aria-pressed={note.isFavorite}
            className={cn(
              "size-8 rounded-lg border",
              note.isFavorite
                ? "border-brand bg-brand text-primary-foreground hover:bg-primary-hover"
                : "border-border bg-card text-muted-foreground hover:border-brand hover:text-brand",
            )}
            disabled={updateNote.isPending}
            onClick={onToggleFavorite}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name={note.isFavorite ? "heart-fill" : "heart"} size={18} />
          </Button>

          <NoteActionsMenu
            isPending={updateNote.isPending}
            note={note}
            onDelete={() => setDeleteOpen(true)}
            onEdit={() => setEditOpen(true)}
            onToggleFavorite={onToggleFavorite}
            onTogglePin={onTogglePin}
          />
        </div>
      </div>

      {isTextHidden ? (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-secondary/60 p-3">
          <p className="text-sm text-muted-foreground">{t("card.spoilerHidden")}</p>
          <Button
            aria-label={t("card.spoilerRevealAria")}
            onClick={() => setSpoilerRevealed(true)}
            size="sm"
            variant="secondary"
          >
            <UiIcon name="eye" size={14} />
            {t("card.spoilerShow")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1">
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-line text-foreground",
              isClampable && !isTextExpanded && "line-clamp-5",
            )}
          >
            {note.text}
          </p>
          {isClampable ? (
            <Button
              className="h-auto p-0"
              onClick={() => setTextExpanded((expanded) => !expanded)}
              size="xs"
              variant="link"
            >
              {t(isTextExpanded ? "card.showLess" : "card.showMore")}
            </Button>
          ) : null}
          {note.isSpoiler ? (
            <Button onClick={() => setSpoilerRevealed(false)} size="sm" variant="secondary">
              <UiIcon name="eye-off" size={14} />
              {t("card.spoilerHide")}
            </Button>
          ) : null}
        </div>
      )}

      {location === null ? null : <p className="text-xs text-muted-foreground">{location}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {isEdited
            ? t("card.updated", { date: formatDate(note.updatedAt, locale) })
            : formatDate(note.createdAt, locale)}
        </span>

        {showEntity && entity !== null ? (
          <Button asChild size="xs" variant="link">
            <Link href={noteEntityHref(entity)}>
              {t(`card.entityLink.${entity.type}`)}
              <UiIcon name="arrow-right" size={14} />
            </Link>
          </Button>
        ) : null}
      </div>

      {entity === null ? null : (
        <NoteFormDialog entity={entity} note={note} onOpenChange={setEditOpen} open={isEditOpen} />
      )}

      <DeleteNoteDialog
        isDeleting={deleteNote.isPending}
        onConfirm={onConfirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleteNote.isPending) setDeleteOpen(false);
        }}
        open={isDeleteOpen}
      />
    </article>
  );
}

function isLongText(text: string): boolean {
  return text.length > CLAMP_TEXT_LENGTH || text.split("\n").length > CLAMP_TEXT_LINES;
}

function noteCategoryChip(
  note: NoteView,
  labels: { custom: (value: string) => string; label: (category: NoteCategory) => string },
): Nullable<string> {
  if (note.category === null) return null;
  if (note.category !== NOTE_CUSTOM_CATEGORY) return labels.label(note.category);
  if (note.customCategory === null) return labels.label(note.category);
  return labels.custom(note.customCategory);
}
