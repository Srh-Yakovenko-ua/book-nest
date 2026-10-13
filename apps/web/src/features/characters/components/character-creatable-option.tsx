"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export type CreatableEntryDisplay = (
  | { count: number; kind: "suggestion" }
  | { kind: "current"; saved: boolean }
  | { kind: "standard" | "useCustom" }
) & {
  id: string;
  text: string;
};

type CharacterCreatableOptionProps = {
  active: boolean;
  committed: boolean;
  entry: CreatableEntryDisplay;
  onHighlight: () => void;
  onPick: () => void;
};

export function CharacterCreatableOption({
  active,
  committed,
  entry,
  onHighlight,
  onPick,
}: CharacterCreatableOptionProps) {
  const t = useTranslations("characters.creatableSelect");
  const noteId = `${entry.id}-note`;
  const hasNote = entry.kind === "useCustom" || (entry.kind === "current" && !entry.saved);

  return (
    <button
      aria-describedby={hasNote ? noteId : undefined}
      aria-selected={active}
      className="relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-left text-sm outline-hidden select-none aria-selected:bg-accent aria-selected:text-accent-foreground"
      id={entry.id}
      onClick={onPick}
      onPointerMove={onHighlight}
      role="option"
      tabIndex={-1}
      type="button"
    >
      {entry.kind === "useCustom" ? (
        <>
          <UiIcon className="shrink-0 text-primary" name="plus" size={16} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{entry.text}</span>
            <span aria-hidden className="truncate text-xs text-muted-foreground" id={noteId}>
              {t("savedWithCharacter")}
            </span>
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate">{entry.text}</span>
      )}
      {entry.kind === "current" && !entry.saved ? (
        <Badge aria-hidden id={noteId} variant="warning">
          {t("notSaved")}
        </Badge>
      ) : null}
      {entry.kind === "suggestion" ? (
        <>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {entry.count}
          </span>
          <span className="sr-only">{t("usageCount", { count: entry.count })}</span>
        </>
      ) : null}
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        {committed ? <UiIcon name="check" size={16} /> : null}
      </span>
    </button>
  );
}
