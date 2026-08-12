"use client";

import type { RelatedListView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { ListSidebarCard } from "./list-sidebar";

type ListRelatedCardProps = {
  lists: RelatedListView[];
};

const COLLAPSED_ROW_COUNT = 3;

export function ListRelatedCard({ lists }: ListRelatedCardProps) {
  const t = useTranslations("lists.details.sidebar.related");

  if (lists.length === 0) return null;

  return (
    <ListSidebarCard icon="layers" title={t("title")}>
      <RelatedRows lists={lists} />
    </ListSidebarCard>
  );
}

function RelatedRows({ lists }: ListRelatedCardProps) {
  const t = useTranslations("lists.details.sidebar.related");
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? lists : lists.slice(0, COLLAPSED_ROW_COUNT);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {visible.map((list) => (
          <li key={list.id}>
            <Link
              className="group/list -mx-1.5 flex cursor-pointer flex-col gap-0.5 rounded-lg p-1.5 no-underline transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
              href={`/lists/${list.id}`}
            >
              <span className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover/list:text-primary">
                {list.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("shared", { shared: list.sharedCount, total: list.bookCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {lists.length <= COLLAPSED_ROW_COUNT ? null : (
        <Button className="w-full" onClick={() => setExpanded(!expanded)} size="sm" variant="ghost">
          <UiIcon
            aria-hidden
            className={expanded ? "rotate-180" : undefined}
            name="chevron-down"
            size={16}
          />
          {expanded ? t("collapse") : t("showAll", { count: lists.length })}
        </Button>
      )}
    </div>
  );
}
