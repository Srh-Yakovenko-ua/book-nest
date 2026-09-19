"use client";

import type { NoteFilter, NoteQuickCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";

import { NOTES_ARCHIVE } from "../model/notes-archive-query";

type NotesQuickChipsProps = {
  counts: NoteQuickCounts | undefined;
  onChange: (filter: NoteFilter) => void;
  value: NoteFilter;
};

export function NotesQuickChips({ counts, onChange, value }: NotesQuickChipsProps) {
  const t = useTranslations("notes.archive");

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <ChipGroup
        className="flex-nowrap"
        label={t("toolbar.quickFilterLabel")}
        mode="single"
        onValueChange={(next) => {
          const match = NOTES_ARCHIVE.quickFilters.find((option) => option === next);
          if (match !== undefined) onChange(match);
        }}
        options={NOTES_ARCHIVE.quickFilters.map((option) => ({
          label: <QuickChipLabel count={counts?.[option]} label={t(`quickFilter.${option}`)} />,
          value: option,
        }))}
        size="sm"
        value={value}
      />
    </div>
  );
}

function QuickChipLabel({ count, label }: { count: number | undefined; label: string }) {
  return (
    <>
      {label}
      {count === undefined ? null : (
        <span className="text-muted-foreground tabular-nums in-data-[state=on]:text-primary-foreground">
          {count}
        </span>
      )}
    </>
  );
}
