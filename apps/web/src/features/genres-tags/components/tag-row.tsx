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

import type { TagCardItem } from "../model/tags-derive";

import { TagChip } from "./tag-chip";

type TagRowProps = {
  onDelete: () => void;
  onEdit: () => void;
  tag: TagCardItem;
};

export function TagRow({ onDelete, onEdit, tag }: TagRowProps) {
  const t = useTranslations("genresTags.tags");
  const tType = useTranslations("genresTags.types");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-card transition-colors duration-150 hover:border-accent-border">
      <TagChip className="shrink-0" tag={tag} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs text-muted-foreground">{tType(tag.type)}</span>
        {tag.description === null ? null : (
          <span className="truncate text-xs text-muted-foreground/80">{tag.description}</span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("menu", { name: tag.name })}
            className="size-8 shrink-0 rounded-lg border-[1.5px] border-border bg-card text-muted-foreground transition-all duration-[180ms] ease-out hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent"
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
    </div>
  );
}
