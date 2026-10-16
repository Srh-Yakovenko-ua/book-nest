"use client";

import type { KeyboardEvent } from "react";

import { useTranslations } from "next-intl";

import { ActionChip, ActionChipButton } from "@/components/action-chip";
import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";

type CharacterRoleChipProps = {
  isSpoiler: boolean;
  label: string;
  onRemove: () => void;
  onToggleSpoiler: () => void;
};

const SPOILER_TOGGLE = {
  hidden: {
    ariaLabel: "spoilerToggle.unmarkRole",
    icon: "eye-off",
    tooltip: "spoilerToggle.unmark",
  },
  visible: {
    ariaLabel: "spoilerToggle.markRole",
    icon: "eye",
    tooltip: "spoilerToggle.mark",
  },
} as const;

export function CharacterRoleChip({
  isSpoiler,
  label,
  onRemove,
  onToggleSpoiler,
}: CharacterRoleChipProps) {
  const t = useTranslations("characters.rolePicker");
  const spoilerToggle = SPOILER_TOGGLE[isSpoiler ? "hidden" : "visible"];

  return (
    <ActionChip
      actions={
        <>
          <TooltipHint label={t(spoilerToggle.tooltip)}>
            <ActionChipButton
              aria-label={t(spoilerToggle.ariaLabel, { role: label })}
              aria-pressed={isSpoiler}
              onClick={onToggleSpoiler}
              onKeyDown={keepKeysFromRoleList}
            >
              <UiIcon name={spoilerToggle.icon} size={16} />
            </ActionChipButton>
          </TooltipHint>
          <TooltipHint label={t("removeTooltip")}>
            <ActionChipButton
              aria-label={t("remove", { role: label })}
              onClick={onRemove}
              onKeyDown={keepKeysFromRoleList}
            >
              <UiIcon name="x" size={16} />
            </ActionChipButton>
          </TooltipHint>
        </>
      }
      label={label}
      spoiler={isSpoiler}
    />
  );
}

const KEYS_KEPT_FROM_ROLE_LIST = new Set(["ArrowDown", "ArrowUp", "End", "Enter", "Home"]);

function keepKeysFromRoleList(event: KeyboardEvent<HTMLButtonElement>) {
  if (KEYS_KEPT_FROM_ROLE_LIST.has(event.key)) event.stopPropagation();
}
