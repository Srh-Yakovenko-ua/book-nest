"use client";

import type { KeyboardEvent } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type CharacterRoleChipProps = {
  isSpoiler: boolean;
  label: string;
  onRemove: () => void;
  onToggleSpoiler: () => void;
};

export function CharacterRoleChip({
  isSpoiler,
  label,
  onRemove,
  onToggleSpoiler,
}: CharacterRoleChipProps) {
  const t = useTranslations("characters.rolePicker");
  const iconButtonClassName =
    "relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-current opacity-80 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-current/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border py-0 pr-1.5 pl-2.5 text-[0.8125rem] font-semibold whitespace-nowrap",
        isSpoiler
          ? "border-dashed border-border bg-secondary/50 text-muted-foreground"
          : "border-accent-border bg-accent text-accent-foreground",
      )}
    >
      <span className="overflow-hidden text-ellipsis" title={label}>
        {label}
      </span>
      <button
        aria-label={t("toggleSpoiler", { role: label })}
        aria-pressed={isSpoiler}
        className={iconButtonClassName}
        onClick={onToggleSpoiler}
        onKeyDown={keepKeysFromRoleList}
        type="button"
      >
        <UiIcon className="size-3.5" name={isSpoiler ? "eye-off" : "eye"} size={14} />
      </button>
      <button
        aria-label={t("remove", { role: label })}
        className={iconButtonClassName}
        onClick={onRemove}
        onKeyDown={keepKeysFromRoleList}
        type="button"
      >
        <UiIcon className="size-3" name="x" size={12} />
      </button>
    </span>
  );
}

const KEYS_KEPT_FROM_ROLE_LIST = new Set(["ArrowDown", "ArrowUp", "End", "Enter", "Home"]);

function keepKeysFromRoleList(event: KeyboardEvent<HTMLButtonElement>) {
  if (KEYS_KEPT_FROM_ROLE_LIST.has(event.key)) event.stopPropagation();
}
