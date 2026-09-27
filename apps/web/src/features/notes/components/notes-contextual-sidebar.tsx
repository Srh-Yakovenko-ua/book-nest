"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

import type { RecordNoteImpression } from "../hooks/use-note-rediscovery-impression";
import type { PostFinishReview } from "../hooks/use-post-finish-review";
import type { NotesOverview } from "../model/notes-overview";

import { useSelectedNoteFullView } from "../hooks/use-note-full-view";
import { NoteFullViewDialog } from "./note-full-view-dialog";
import { NotesContextualOverview } from "./notes-contextual-overview";

type NotesContextualSidebarProps = {
  overview: NotesOverview;
  postFinishReview: PostFinishReview;
  recordImpression: RecordNoteImpression;
};

export function NotesContextualSidebar({
  overview,
  postFinishReview,
  recordImpression,
}: NotesContextualSidebarProps) {
  const t = useTranslations("notes.overview");
  const fullView = useSelectedNoteFullView();

  return (
    <aside
      aria-label={t("label")}
      className="grid min-w-0 items-start gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] xl:grid-cols-1"
    >
      <NotesContextualOverview
        onOpenNote={fullView.open}
        overview={overview}
        postFinishReview={postFinishReview}
        recordImpression={recordImpression}
      />

      {fullView.note === null ? null : (
        <NoteFullViewDialog
          note={fullView.note}
          onOpenChange={fullView.onOpenChange}
          open={fullView.isOpen}
          triggerRef={fullView.triggerRef}
        />
      )}
    </aside>
  );
}

const CONTEXTUAL_SKELETON_BLOCKS = ["first", "second"] as const;

export function NotesContextualSidebarSkeleton() {
  return (
    <div
      aria-hidden
      className="flex min-w-0 flex-col gap-4"
      data-slot="notes-contextual-placeholder"
    >
      {CONTEXTUAL_SKELETON_BLOCKS.map((block) => (
        <div
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
          key={block}
        >
          <Skeleton className="h-4 w-32" />
          <div className="flex items-start gap-3">
            <Skeleton className="h-20 w-14 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}
