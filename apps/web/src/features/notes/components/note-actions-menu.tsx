"use client";

import type { NoteView } from "@app/shared";

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
  isPending: boolean;
  note: NoteView;
  onDelete: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
};

export function NoteActionsMenu({
  isPending,
  note,
  onDelete,
  onEdit,
  onToggleFavorite,
  onTogglePin,
}: NoteActionsMenuProps) {
  const t = useTranslations("notes");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("card.menu")}
          className="size-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-brand hover:text-brand"
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onEdit}>
          <UiIcon name="edit" size={16} />
          {t("actions.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPending} onSelect={onTogglePin}>
          <UiIcon name="bookmark" size={16} />
          {note.isPinned ? t("actions.unpin") : t("actions.pin")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPending} onSelect={onToggleFavorite}>
          <UiIcon name={note.isFavorite ? "heart-fill" : "heart"} size={16} />
          {note.isFavorite ? t("actions.unfavorite") : t("actions.favorite")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <UiIcon name="trash" size={16} />
          {t("actions.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
