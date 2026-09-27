"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NoteActionsMenuProps = {
  onDelete: () => void;
  onEdit: Nullable<() => void>;
};

export function NoteActionsMenu({ onDelete, onEdit }: NoteActionsMenuProps) {
  const t = useTranslations("notes");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("card.menu")} size="icon-sm" variant="ghost">
          <UiIcon className="text-muted-foreground" name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit === null ? null : (
          <>
            <DropdownMenuItem onSelect={onEdit}>
              <UiIcon name="edit" size={14} />
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <UiIcon name="trash" size={14} />
          {t("actions.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
