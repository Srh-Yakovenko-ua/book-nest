"use client";

import type { NoteFilter, NoteQuickCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import { NOTES_ARCHIVE } from "../model/notes-archive-query";

type NotesQuickChipsProps = {
  counts: NoteQuickCounts | undefined;
  countsPending?: boolean;
  onChange: (filter: NoteFilter) => void;
  value: NoteFilter;
};

export function NotesQuickChips({ counts, countsPending, onChange, value }: NotesQuickChipsProps) {
  const t = useTranslations("notes.archive");

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        countsPending={countsPending}
        label={t("toolbar.quickFilterLabel")}
        mode="single"
        onValueChange={(next) => {
          const match = NOTES_ARCHIVE.quickFilters.find((option) => option === next);
          if (match !== undefined) onChange(match);
        }}
        options={NOTES_ARCHIVE.quickFilters.map((option) => ({
          count: counts?.[option],
          label: t(`quickFilter.${option}`),
          value: option,
        }))}
        size="sm"
        value={value}
      />
    </div>
  );
}
