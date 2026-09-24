"use client";

import type { TagCatalogListItem } from "@app/shared";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import { TagActionsMenu } from "./tag-actions-menu";
import { TagColorDot } from "./tag-color-dot";
import { TagDescription } from "./tag-description";
import { TagUsage } from "./tag-usage";

type TagCardProps = {
  onDelete: () => void;
  onEdit: () => void;
  tag: TagCatalogListItem;
};

export function TagCard({ onDelete, onEdit, tag }: TagCardProps) {
  const tType = useTranslations("tags.typeBadge");

  return (
    <article className="flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <div className="flex items-center gap-3">
        <TagColorDot color={tag.color} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="line-clamp-2 min-w-0 font-heading text-base leading-snug font-semibold break-words text-ink">
            {tag.name}
          </h3>
          <Badge className="shrink-0" variant="secondary">
            {tType(tag.type)}
          </Badge>
        </div>
        <div className="-mr-1.5 shrink-0 self-start">
          <TagActionsMenu name={tag.name} onDelete={onDelete} onEdit={onEdit} />
        </div>
      </div>

      {tag.description === null ? null : (
        <TagDescription className="line-clamp-2 leading-relaxed" text={tag.description} />
      )}

      <TagUsage className="mt-auto border-t border-border pt-3" tag={tag} />
    </article>
  );
}
