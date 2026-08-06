"use client";

import type { CustomListCard } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import { ListCardMenu } from "./list-card-menu";

type ListRowProps = {
  list: CustomListCard;
  onDelete: () => void;
  onEdit: () => void;
};

const MAX_COVERS = 4;

const LIST_ROW_COVERS_SECTION = "flex h-16 w-[13.125rem] shrink-0 items-center gap-1.5 self-center";

export function ListRow({ list, onDelete, onEdit }: ListRowProps) {
  const t = useTranslations("lists.catalog.card");
  const locale = useLocale();

  return (
    <article className="group/list-row @container/list-row relative flex min-h-[6.5rem] items-stretch gap-3.5 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <ListRowCovers
        bookCount={list.bookCount}
        coverAlt={t("coverAlt", { name: list.name })}
        covers={list.previewCovers}
        emptyLabel={t("emptyPreview")}
      />

      <div className="hidden w-px self-stretch bg-border @lg/list-row:block" />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <h3 className="line-clamp-2 font-heading text-sm leading-tight font-bold text-ink">
          <Link
            className="text-ink no-underline transition-colors outline-none group-hover/list-row:text-primary after:absolute after:inset-0 focus-visible:text-primary"
            href={`/lists/${list.id}`}
          >
            {list.name}
          </Link>
        </h3>
        {list.description === null ? null : (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {list.description}
          </p>
        )}
      </div>

      <div className="hidden w-px self-stretch bg-border @lg/list-row:block" />

      <div className="hidden shrink-0 flex-col justify-center gap-1 text-[0.8125rem] text-muted-foreground @lg/list-row:flex @lg/list-row:w-36">
        <span className="inline-flex items-center gap-1.5">
          <UiIcon className="shrink-0 text-icon" name="book" size={15} />
          {t("books", { count: list.bookCount })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UiIcon className="shrink-0 text-icon" name="calendar" size={15} />
          {formatDate(list.updatedAt, locale)}
        </span>
      </div>

      <div className="relative z-10 flex shrink-0 items-start">
        <ListCardMenu list={list} onDelete={onDelete} onEdit={onEdit} />
      </div>
    </article>
  );
}

function ListRowCovers({
  bookCount,
  coverAlt,
  covers,
  emptyLabel,
}: {
  bookCount: number;
  coverAlt: string;
  covers: CustomListCard["previewCovers"];
  emptyLabel: string;
}) {
  if (bookCount === 0) {
    return (
      <div className={LIST_ROW_COVERS_SECTION}>
        <span
          aria-label={emptyLabel}
          className="grid h-full w-full place-items-center rounded-lg border border-dashed border-border bg-accent/40 text-icon"
          role="img"
        >
          <UiIcon name="list" size={20} />
        </span>
      </div>
    );
  }

  const visible = covers.slice(0, MAX_COVERS);
  const placeholderCount = Math.max(0, Math.min(MAX_COVERS, bookCount) - visible.length);

  return (
    <div className={LIST_ROW_COVERS_SECTION}>
      {visible.map((cover) => (
        <span
          className="relative aspect-[3/4] h-full overflow-hidden rounded-md bg-accent shadow-soft"
          key={cover.id}
        >
          <Image
            alt={coverAlt}
            className="object-cover"
            fill
            sizes="48px"
            src={cover.urls.thumb}
            unoptimized
          />
        </span>
      ))}
      {Array.from({ length: placeholderCount }, (_, index) => (
        <span
          className="grid aspect-[3/4] h-full place-items-center rounded-md bg-accent text-accent-foreground/60"
          key={index}
        >
          <UiIcon name="book" size={16} />
        </span>
      ))}
    </div>
  );
}
