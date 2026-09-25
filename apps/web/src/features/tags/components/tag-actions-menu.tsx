"use client";

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

type TagActionsMenuProps = {
  name: string;
  onDelete: () => void;
  onEdit: () => void;
};

export function TagActionsMenu({ name, onDelete, onEdit }: TagActionsMenuProps) {
  const t = useTranslations("tags.item");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("actions", { name })}
          className="text-muted-foreground hover:text-foreground"
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onEdit}>
          <UiIcon name="edit" size={16} />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <UiIcon name="trash" size={16} />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
