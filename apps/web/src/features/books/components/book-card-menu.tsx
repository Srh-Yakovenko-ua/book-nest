"use client";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BookCardMenuProps = {
  deleteLabel: string;
  menuLabel: string;
  onDelete: () => void;
};

export function BookCardMenu({ deleteLabel, menuLabel, onDelete }: BookCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={menuLabel}
          className="text-icon hover:text-foreground"
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <UiIcon name="trash" size={16} />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
