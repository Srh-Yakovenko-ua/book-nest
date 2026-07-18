"use client";

import type { NoteEntityType, NoteView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import type { NoteEntityRef } from "../model/note-entity";

import { noteEntityId } from "../model/note-entity";
import { NoteCard } from "./note-card";
import { NoteCardSkeleton } from "./note-card-skeleton";
import { NoteFormDialog } from "./note-form-dialog";
import { NotesErrorState } from "./notes-error-state";

const NOTES_PREVIEW_LIMIT = 3;
const NOTES_SKELETON_COUNT = 2;

const NOTES_ARCHIVE_PARAMS = {
  book: "bookId",
  series: "seriesId",
} as const satisfies Record<NoteEntityType, string>;

type EntityNotesBlockProps = {
  entity: NoteEntityRef;
  isError: boolean;
  isPending: boolean;
  notes: NoteView[];
  onRetry: () => void;
  totalCount: number;
};

export function EntityNotesBlock({
  entity,
  isError,
  isPending,
  notes,
  onRetry,
  totalCount,
}: EntityNotesBlockProps) {
  const t = useTranslations("notes.blocks");
  const [isCreateOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Card className="shadow-detail-block">
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <UiIcon name="note" size={18} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <CardTitle asChild>
                <h2>
                  {t(`${entity.type}.title`)}
                  {totalCount > 0 ? (
                    <span className="font-normal text-muted-foreground tabular-nums">
                      {" · "}
                      {totalCount}
                    </span>
                  ) : null}
                </h2>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t(`${entity.type}.subtitle`)}</p>
            </div>
          </div>

          <CardAction>
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <UiIcon name="plus" size={14} />
              {t("add")}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-4">
          <EntityNotesBody
            entity={entity}
            isError={isError}
            isPending={isPending}
            notes={notes}
            onAdd={() => setCreateOpen(true)}
            onRetry={onRetry}
            totalCount={totalCount}
          />
        </CardContent>
      </Card>

      <NoteFormDialog entity={entity} onOpenChange={setCreateOpen} open={isCreateOpen} />
    </>
  );
}

function EntityNotesBody({
  entity,
  isError,
  isPending,
  notes,
  onAdd,
  onRetry,
  totalCount,
}: EntityNotesBlockProps & { onAdd: () => void }) {
  const t = useTranslations("notes.blocks");
  const tStates = useTranslations("notes.states");

  if (isPending) {
    return (
      <div aria-busy aria-label={tStates("loading")} className="flex flex-col gap-3" role="status">
        {Array.from({ length: NOTES_SKELETON_COUNT }, (_, index) => (
          <NoteCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) return <NotesErrorState onRetry={onRetry} />;

  if (notes.length === 0) return <EntityNotesEmpty onAdd={onAdd} type={entity.type} />;

  const visibleNotes = notes.slice(0, NOTES_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {visibleNotes.map((note) => (
          <li key={note.id}>
            <NoteCard note={note} />
          </li>
        ))}
      </ul>

      {totalCount > visibleNotes.length ? (
        <Button asChild className="self-start" size="sm" variant="ghost">
          <Link href={notesArchiveHref(entity)}>
            {t(`${entity.type}.viewAll`, { count: totalCount })}
            <UiIcon name="arrow-right" size={14} />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function EntityNotesEmpty({ onAdd, type }: { onAdd: () => void; type: NoteEntityType }) {
  const t = useTranslations("notes.blocks");

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="note" size={22} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-semibold text-ink">{t(`${type}.emptyTitle`)}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {t(`${type}.emptyDescription`)}
        </p>
      </div>
      <Button className="mt-1" onClick={onAdd} size="sm" variant="secondary">
        <UiIcon name="plus" size={14} />
        {t("addFirst")}
      </Button>
    </div>
  );
}

function notesArchiveHref(entity: NoteEntityRef): string {
  const params = new URLSearchParams({
    [NOTES_ARCHIVE_PARAMS[entity.type]]: noteEntityId(entity),
  });

  return `/notes?${params.toString()}`;
}
