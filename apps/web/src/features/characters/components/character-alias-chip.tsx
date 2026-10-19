"use client";

import type { Ref } from "react";

import { useTranslations } from "next-intl";

import { ActionChip, ActionChipButton } from "@/components/action-chip";
import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";

import type { CharacterAliasRow } from "../model/character-aliases";

type CharacterAliasChipProps = {
  active: boolean;
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

export function CharacterAliasChip({
  active,
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

  return (
    <ActionChip
      actions={
        <>
          <TooltipHint label={t("editTooltip")}>
            <ActionChipButton
              aria-describedby={errorId}
              aria-label={t("edit", { name: row.name, type: typeLabel })}
              highlighted={active}
              onClick={onEdit}
              ref={editButtonRef}
            >
              <UiIcon name="edit" size={16} />
            </ActionChipButton>
          </TooltipHint>
          <TooltipHint label={t(spoilerToggle.tooltip)}>
            <ActionChipButton
              aria-label={t(spoilerToggle.ariaLabel, { name: row.name })}
              aria-pressed={row.isSpoiler}
              onClick={onToggleSpoiler}
            >
              <UiIcon name={spoilerToggle.icon} size={16} />
            </ActionChipButton>
          </TooltipHint>
          <TooltipHint label={t("removeTooltip")}>
            <ActionChipButton aria-label={t("remove", { name: row.name })} onClick={onRemove}>
              <UiIcon name="x" size={16} />
            </ActionChipButton>
          </TooltipHint>
        </>
      }
      active={active}
      invalid={errorId !== undefined}
      label={row.name}
      secondaryLabel={typeLabel}
      spoiler={row.isSpoiler}
    />
  );
}
