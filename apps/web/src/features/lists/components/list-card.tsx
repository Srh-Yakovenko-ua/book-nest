"use client";

import type { CustomListCard } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import { ListCardCovers, ListCardCoversEmpty } from "./list-card-covers";

type ListCardProps = {
  list: CustomListCard;
  onDelete: () => void;
  onEdit: () => void;
};

export function ListCard({ list, onDelete, onEdit }: ListCardProps) {
  const t = useTranslations("lists.catalog.card");
  const locale = useLocale();
  const isEmpty = list.bookCount === 0;

  return (
    <article className="group/list-card relative flex h-full flex-col gap-3.5 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <div className="absolute top-3 right-3 z-10">
        <ListCardMenu list={list} onDelete={onDelete} onEdit={onEdit} />
      </div>

      <div className="flex flex-col gap-1.5 pr-9">
        <h3 className="line-clamp-2 min-h-[2lh] font-heading text-[1.0625rem] leading-tight font-bold text-ink">
          <Link
            className="text-ink no-underline transition-colors outline-none group-hover/list-card:text-primary after:absolute after:inset-0 focus-visible:text-primary"
            href={`/lists/${list.id}`}
          >
            {list.name}
          </Link>
        </h3>
        <p className="line-clamp-2 min-h-[2lh] text-[0.8125rem] leading-relaxed text-muted-foreground">
          {list.description}
        </p>
      </div>

      {isEmpty ? (
        <ListCardCoversEmpty label={t("emptyPreview")} />
      ) : (
        <ListCardCovers
          bookCount={list.bookCount}
          coverAlt={t("coverAlt", { name: list.name })}
          covers={list.previewCovers}
        />
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <UiIcon className="shrink-0 text-icon" name="book" size={15} />
          {t("books", { count: list.bookCount })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UiIcon className="shrink-0 text-icon" name="calendar" size={15} />
          {formatDate(list.updatedAt, locale)}
        </span>
      </div>
    </article>
  );
}

function ListCardMenu({
  list,
  onDelete,
  onEdit,
}: {
  list: CustomListCard;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("lists.catalog.card");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("menu", { name: list.name })}
          className="size-8 rounded-lg border-[1.5px] border-border bg-card text-muted-foreground transition-all duration-[180ms] ease-out hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent"
          onClick={(event) => event.stopPropagation()}
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
  );
}
