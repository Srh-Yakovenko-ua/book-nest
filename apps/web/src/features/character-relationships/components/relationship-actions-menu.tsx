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

import type { RelationshipActions } from "../model/relationship-adapter";

type RelationshipActionsMenuProps = {
  actions: RelationshipActions;
  participantNames: { source: string; target: string };
  relationshipId: string;
};

export function RelationshipActionsMenu({
  actions,
  participantNames,
  relationshipId,
}: RelationshipActionsMenuProps) {
  const t = useTranslations("relationships.card.actions");
  const { onDelete, onEdit } = actions;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("menu", participantNames)}
          className="relative z-10 -mt-1 -mr-1 shrink-0"
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon className="text-muted-foreground" name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit === undefined ? null : (
          <DropdownMenuItem onSelect={() => onEdit(relationshipId)}>
            <UiIcon name="edit" size={14} />
            {t("edit")}
          </DropdownMenuItem>
        )}
        {onEdit === undefined || onDelete === undefined ? null : <DropdownMenuSeparator />}
        {onDelete === undefined ? null : (
          <DropdownMenuItem onSelect={() => onDelete(relationshipId)} variant="destructive">
            <UiIcon name="trash" size={14} />
            {t("delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
