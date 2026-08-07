"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { LibraryBookLinkComponent } from "../model/library-book";

import { LibraryGenresPie } from "./library-genres-pie";

export type LibraryOverviewBook = {
  author: string;
  href: string;
  id: string;
  title: string;
};

export type LibraryOverviewGenre = {
  count: number;
  key: string;
  name: string;
};

export type LibraryOverviewTag = {
  id: string;
  name: string;
};

const VISIBLE_LIMIT = 3;

export function LibraryOverviewSection({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function LibraryRecentlyAddedBlock({
  books,
  isLoading,
  linkComponent,
}: {
  books: LibraryOverviewBook[];
  isLoading: boolean;
  linkComponent?: LibraryBookLinkComponent;
}) {
  const t = useTranslations("books.library.sidebar");
  const LinkComp: "a" | LibraryBookLinkComponent = linkComponent ?? "a";

  if (isLoading) return <RowSkeleton />;
  if (books.length === 0) return <EmptyText>{t("recentlyAddedEmpty")}</EmptyText>;

  return (
    <ul className="flex flex-col gap-1">
      {books.slice(0, VISIBLE_LIMIT).map((book) => (
        <li key={book.id}>
          <LinkComp
            className="group/recent flex flex-col gap-0.5 rounded-md px-2 py-1.5 no-underline transition-colors hover:bg-secondary"
            href={book.href}
          >
            <span className="truncate text-sm font-medium text-ink transition-colors group-hover/recent:text-primary">
              {book.title}
            </span>
            <span className="truncate text-xs text-muted-foreground">{book.author}</span>
          </LinkComp>
        </li>
      ))}
    </ul>
  );
}

export function LibraryTopGenresBlock({
  genres,
  isLoading,
}: {
  genres: LibraryOverviewGenre[];
  isLoading: boolean;
}) {
  const t = useTranslations("books.library.sidebar");

  if (isLoading) return <PieSkeleton />;
  if (genres.length === 0) return <EmptyText>{t("topGenresEmpty")}</EmptyText>;

  return (
    <LibraryGenresPie ariaLabel={t("topGenresChart")} genres={genres.slice(0, VISIBLE_LIMIT)} />
  );
}

export function LibraryTopTagsBlock({
  isLoading,
  tags,
}: {
  isLoading: boolean;
  tags: LibraryOverviewTag[];
}) {
  const t = useTranslations("books.library.sidebar");

  if (isLoading) return <ChipSkeleton />;
  if (tags.length === 0) return <EmptyText>{t("topTagsEmpty")}</EmptyText>;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.slice(0, VISIBLE_LIMIT).map((tag) => (
        <li
          className="inline-flex items-center gap-1 rounded-full border border-border bg-tag px-2.5 py-0.5 text-xs font-medium text-tag-foreground"
          key={tag.id}
        >
          <UiIcon className="text-icon" name="tag" size={12} />
          {tag.name}
        </li>
      ))}
    </ul>
  );
}

function ChipSkeleton() {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function PieSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="size-[140px] rounded-full" />
      <div className="flex w-full flex-col gap-1.5">
        {Array.from({ length: VISIBLE_LIMIT }, (_, index) => (
          <div className="flex items-center gap-2" key={index}>
            <Skeleton className="size-2.5 rounded-[3px]" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: VISIBLE_LIMIT }, (_, index) => (
        <div className="flex flex-col gap-1 px-2" key={index}>
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
