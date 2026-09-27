"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  MobilePageOverviewPanel,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import type { RecordNoteImpression } from "../hooks/use-note-rediscovery-impression";
import type { PostFinishReview } from "../hooks/use-post-finish-review";
import type { NotesOverview } from "../model/notes-overview";

import { useSelectedNoteFullView } from "../hooks/use-note-full-view";
import { NoteFullViewDialog } from "./note-full-view-dialog";
import { NotesContextualOverview } from "./notes-contextual-overview";

type NotesOverviewPanelProps = {
  isLoading: boolean;
  overview: Nullable<NotesOverview>;
  postFinishReview: PostFinishReview;
  recordImpression: RecordNoteImpression;
  summaryCards: Nullable<LibrarySummaryCard[]>;
};

export function NotesOverviewPanel({
  isLoading,
  overview,
  postFinishReview,
  recordImpression,
  summaryCards,
}: NotesOverviewPanelProps) {
  const t = useTranslations("notes.overview.panel");
  const overviewPanel = useMobilePageOverviewPanel();
  const fullView = useSelectedNoteFullView();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function returnFocusToTrigger() {
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const panel: typeof overviewPanel = {
    closeThen: (action) => {
      returnFocusToTrigger();
      overviewPanel.closeThen(action);
    },
    isOpen: overviewPanel.isOpen,
    setOpen: (open) => {
      overviewPanel.setOpen(open);
      if (!open) returnFocusToTrigger();
    },
  };

  return (
    <>
      <Button
        aria-expanded={panel.isOpen}
        aria-haspopup="dialog"
        className="h-11 w-full justify-start gap-2 rounded-xl px-3.5 shadow-card"
        onClick={() => panel.setOpen(true)}
        ref={triggerRef}
        variant="secondary"
      >
        <UiIcon aria-hidden className="shrink-0 text-primary" name="chart" size={16} />
        <span className="flex-1 truncate text-left font-heading text-sm font-semibold text-ink">
          {t("trigger")}
        </span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground"
          name="chevron-right"
          size={16}
        />
      </Button>

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <div className="flex flex-col gap-4">
          {summaryCards === null ? null : (
            <LibrarySummaryDetails cards={summaryCards} title={t("summaryTitle")} />
          )}
          {overview === null ? null : (
            <NotesContextualOverview
              onOpenNote={(note, trigger) =>
                panel.closeThen(() => fullView.open(note, triggerRef.current ?? trigger))
              }
              overview={overview}
              postFinishReview={postFinishReview}
              recordImpression={recordImpression}
              runAction={panel.closeThen}
            />
          )}
        </div>
      </MobilePageOverviewPanel>

      {fullView.note === null ? null : (
        <NoteFullViewDialog
          note={fullView.note}
          onOpenChange={fullView.onOpenChange}
          open={fullView.isOpen}
          triggerRef={fullView.triggerRef}
        />
      )}
    </>
  );
}
