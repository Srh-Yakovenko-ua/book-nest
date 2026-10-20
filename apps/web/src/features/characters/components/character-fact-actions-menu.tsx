"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CharacterFactActionsMenuProps = {
  factId: string;
  factTitle: string;
  onDelete: (trigger: Nullable<HTMLElement>) => void;
  onEdit: (trigger: Nullable<HTMLElement>) => void;
};

export function CharacterFactActionsMenu({
  factId,
  factTitle,
  onDelete,
  onEdit,
}: CharacterFactActionsMenuProps) {
  const t = useTranslations("characters.facts.card");
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("menu", { title: factTitle })}
          className="relative z-10 -mt-1 -mr-1 shrink-0"
          data-fact-menu-trigger={factId}
          ref={triggerRef}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon className="text-muted-foreground" name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(triggerRef.current)}>
          <UiIcon name="edit" size={14} />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onDelete(triggerRef.current)} variant="destructive">
          <UiIcon name="trash" size={14} />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
