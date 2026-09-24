"use client";

import type { TagCatalogListItem } from "@app/shared";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import { TagActionsMenu } from "./tag-actions-menu";
import { TagDescription } from "./tag-description";
import { TagNameCapsule } from "./tag-name-capsule";
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
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 items-center gap-2 md:shrink-0">
          <TagNameCapsule
            className="text-sm leading-snug"
            color={tag.color}
            name={tag.name}
            variant="row"
          />
          <Badge className="shrink-0" variant="secondary">
            {tType(tag.type)}
          </Badge>
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
