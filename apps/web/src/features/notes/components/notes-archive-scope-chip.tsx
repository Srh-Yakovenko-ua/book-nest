"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { NotesScope } from "../model/notes-archive-query";

type NotesArchiveScopeChipProps = {
  onClear: () => void;
  scope: NotesScope;
};

export function NotesArchiveScopeChip({ onClear, scope }: NotesArchiveScopeChipProps) {
  const t = useTranslations("notes.archive.scope");

  const label =
    scope.name === null
      ? t(`fallback.${scope.entityType}`)
      : t(scope.entityType, { name: scope.name });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-border/60 bg-secondary px-3 py-2">
      <UiIcon className="shrink-0 text-icon" name="filter" size={16} />
      <span className="min-w-0 text-sm text-ink">{label}</span>
      <Button className="ml-auto" onClick={onClear} size="xs" variant="ghost">
        <UiIcon name="x" size={14} />
        {t("clear")}
      </Button>
    </div>
  );
}
