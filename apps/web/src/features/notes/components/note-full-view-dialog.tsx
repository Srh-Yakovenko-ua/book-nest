"use client";

import type { NoteView, Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateLong, formatTime } from "@/lib/format";

import { noteCategoryLabel } from "../model/note-category-label";
import { isMeaningfullyUpdated } from "../model/note-dates";
import { noteEntityRefFromNote } from "../model/note-entity";
import { NoteEntityHeader } from "./note-entity-header";
import { NoteEntityLocation } from "./note-entity-location";

type NoteFullViewDialogProps = {
  note: NoteView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  triggerRef: RefObject<Nullable<HTMLButtonElement>>;
};

export function NoteFullViewDialog({
  note,
  onOpenChange,
  open,
  triggerRef,
}: NoteFullViewDialogProps) {
  const t = useTranslations("notes.fullView");
  const tCategories = useTranslations("notes.categories");
  const locale = useLocale();
  const bodyRef = useRef<HTMLDivElement>(null);

  const entity = noteEntityRefFromNote(note);
  const category = noteCategoryLabel(note, (value) => tCategories(value));
  const stamp = (iso: string) => ({
    date: formatDateLong(iso, locale),
    time: formatTime(iso, locale),
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...(entity === null ? { "aria-describedby": undefined } : {})}
        className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;
          if (trigger === null || !trigger.isConnected) return;
          event.preventDefault();
          trigger.focus();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => bodyRef.current?.focus());
        }}
      >
        <DialogHeader className="min-w-0 pr-8 text-left">
          {entity === null ? (
            <DialogTitle>{t("fallbackTitle")}</DialogTitle>
          ) : (
            <NoteEntityHeader entity={entity} placement="fullView" />
          )}
        </DialogHeader>

        <div
          aria-label={t("textLabel")}
          className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto rounded-md px-1 pb-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          ref={bodyRef}
          role="region"
          tabIndex={0}
        >
          <p className="rounded-lg border border-border bg-secondary/40 p-4 text-base leading-relaxed wrap-anywhere whitespace-pre-line text-foreground">
            {note.text}
          </p>

          {category === null && !note.isSpoiler ? null : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {category === null ? null : (
                <Badge
                  className="h-auto max-w-full text-left wrap-anywhere whitespace-normal"
                  variant="secondary"
                >
                  {category}
                </Badge>
              )}
              {note.isSpoiler ? (
                <Badge variant="warning">
                  <UiIcon name="eye-off" size={12} />
                  {t("spoiler")}
                </Badge>
              ) : null}
            </div>
          )}

          <NoteEntityLocation note={note} placement="fullView" />

          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <p>{t("created", stamp(note.createdAt))}</p>
            {isMeaningfullyUpdated(note) ? <p>{t("updated", stamp(note.updatedAt))}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
