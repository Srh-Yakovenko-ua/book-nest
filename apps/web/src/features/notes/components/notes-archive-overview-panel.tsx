"use client";

import { useTranslations } from "next-intl";

import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { LibrarySummaryDetails } from "@/features/books/components/library-summary-mobile";

import type { NotesArchiveQueryState, NotesSidebarFilter } from "../model/notes-archive-query";

import { NotesArchiveFilterSections } from "./notes-archive-sidebar";

type NotesArchiveOverviewPanelProps = {
  isLoading: boolean;
  onAddNote: () => void;
  onQuickFilter: (filter: NotesSidebarFilter) => void;
  state: NotesArchiveQueryState;
  summaryCards: LibrarySummaryCard[];
};

export function NotesArchiveOverviewPanel({
  isLoading,
  onAddNote,
  onQuickFilter,
  state,
  summaryCards,
}: NotesArchiveOverviewPanelProps) {
  const t = useTranslations("notes.archive.overviewPanel");
  const tDetails = useTranslations("notes.archive.summary.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <LibrarySummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <NotesArchiveFilterSections
            onAddNote={() => panel.closeThen(onAddNote)}
            onQuickFilter={(filter) => panel.closeThen(() => onQuickFilter(filter))}
            state={state}
          />
        </div>
      ),
      id: "filters",
      label: t("tabs.filters"),
    },
  ];

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        loading={isLoading}
        panel={panel}
        subtitle={t("subtitle")}
        tabs={tabs}
        title={t("title")}
      />
    </>
  );
}
