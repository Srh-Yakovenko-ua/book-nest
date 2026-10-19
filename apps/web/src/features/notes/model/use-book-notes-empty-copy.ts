"use client";

import { useTranslations } from "next-intl";

import type { NotesArchiveEmptyCopy } from "./notes-archive-list-state";

export function useBookNotesEmptyCopy(): NotesArchiveEmptyCopy {
  const t = useTranslations("notes");

  return {
    library: {
      desc: t("bookTab.empty.description"),
      illu: "empty-notes",
      primary: { icon: "plus", label: t("archive.addNote") },
      title: t("bookTab.empty.title"),
    },
    search: {
      desc: t("archive.emptySearch.description"),
      illu: "empty-search",
      primary: { icon: "x", label: t("archive.toolbar.searchClear") },
      title: t("archive.emptySearch.title"),
    },
  };
}
