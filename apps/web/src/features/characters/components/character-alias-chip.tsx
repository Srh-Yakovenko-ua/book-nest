"use client";

import type { Ref } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { cn } from "@/lib/utils";

import type { CharacterAliasRow } from "../model/character-aliases";

type CharacterAliasChipProps = {
  editButtonRef: Ref<HTMLButtonElement>;
  errorId: string | undefined;
  onEdit: () => void;
  onRemove: () => void;
  onToggleSpoiler: () => void;
  row: CharacterAliasRow;
};

const SPOILER_TOGGLE = {
  hidden: {
    ariaLabel: "spoilerToggle.unmarkName",
    icon: "eye-off",
    tooltip: "spoilerToggle.unmark",
  },
  visible: {
    ariaLabel: "spoilerToggle.markName",
    icon: "eye",
    tooltip: "spoilerToggle.mark",
  },
} as const;

const ICON_BUTTON_CLASS_NAME =
  "relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-current opacity-80 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-current/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function CharacterAliasChip({
  editButtonRef,
  errorId,
  onEdit,
  onRemove,
  onToggleSpoiler,
  row,
}: CharacterAliasChipProps) {
  const t = useTranslations("characters.aliases");
  const tType = useTranslations("characters.aliasType");
  const spoilerToggle = SPOILER_TOGGLE[row.isSpoiler ? "hidden" : "visible"];
  const typeLabel = tType(row.type);
  const isInvalid = errorId !== undefined;

  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-full border py-0 pr-1.5 text-[0.8125rem] font-semibold whitespace-nowrap",
        row.isSpoiler
          ? "border-dashed border-border bg-secondary/50 text-muted-foreground"
          : "border-accent-border bg-accent text-accent-foreground",
        isInvalid && "border-destructive",
      )}
    >
      <TooltipHint label={row.name}>
        <button
          aria-describedby={errorId}
          aria-label={t("edit", { name: row.name, type: typeLabel })}
          className="flex h-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full pr-0.5 pl-2.5 transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onEdit}
          ref={editButtonRef}
          type="button"
        >
          <span className="max-w-60 truncate">{row.name}</span>
          <span className="shrink-0 text-xs font-medium opacity-75">{typeLabel}</span>
        </button>
      </TooltipHint>
      <TooltipHint label={t(spoilerToggle.tooltip)}>
        <button
          aria-label={t(spoilerToggle.ariaLabel, { name: row.name })}
          aria-pressed={row.isSpoiler}
          className={ICON_BUTTON_CLASS_NAME}
          onClick={onToggleSpoiler}
          type="button"
        >
          <UiIcon className="size-3.5" name={spoilerToggle.icon} size={14} />
        </button>
      </TooltipHint>
      <button
        aria-label={t("remove", { name: row.name })}
        className={ICON_BUTTON_CLASS_NAME}
        onClick={onRemove}
        type="button"
      >
        <UiIcon className="size-3" name="x" size={12} />
      </button>
    </span>
  );
}
