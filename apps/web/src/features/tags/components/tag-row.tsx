"use client";

import type { TagCatalogListItem } from "@app/shared";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import { TagActionsMenu } from "./tag-actions-menu";
import { TagColorDot } from "./tag-color-dot";
import { TagDescription } from "./tag-description";
import { TagUsage } from "./tag-usage";

type TagRowProps = {
  onDelete: () => void;
  onEdit: () => void;
  tag: TagCatalogListItem;
};

export function TagRow({ onDelete, onEdit, tag }: TagRowProps) {
  const tType = useTranslations("tags.typeBadge");

  return (
    <article className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-card transition-colors duration-150 focus-within:border-accent-border hover:border-accent-border motion-reduce:transition-none md:items-center">
      <TagColorDot className="mt-1 md:mt-0" color={tag.color} />

      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 items-center gap-2 md:w-60 md:shrink-0">
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold break-words text-ink md:line-clamp-1">
            {tag.name}
          </h3>
          <Badge variant="secondary">{tType(tag.type)}</Badge>
        </div>
        {tag.description === null ? null : (
          <TagDescription className="truncate md:flex-1" text={tag.description} />
        )}
        <TagUsage className="md:ml-auto md:shrink-0" tag={tag} />
      </div>

      <div className="-my-1 shrink-0">
        <TagActionsMenu name={tag.name} onDelete={onDelete} onEdit={onEdit} />
      </div>
    </article>
  );
}
