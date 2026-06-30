"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

import type { LibraryBookLinkComponent } from "../model/library-book";

export type SidebarBook = {
  author: string;
  href: string;
  id: string;
  title: string;
};

type LibrarySummarySidebarProps = {
  isLoading: boolean;
  linkComponent?: LibraryBookLinkComponent;
  recentlyAdded: SidebarBook[];
  topGenres: { key: string; name: string }[];
  topTags: { id: string; name: string }[];
};

export function LibrarySummarySidebar({
  isLoading,
  linkComponent,
  recentlyAdded,
  topGenres,
  topTags,
}: LibrarySummarySidebarProps) {
  const t = useTranslations("books.library.sidebar");
  const LinkComp: "a" | LibraryBookLinkComponent = linkComponent ?? "a";

  return (
    <aside
      aria-label={t("title")}
      className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <SidebarBlock title={t("topGenres")}>
        {isLoading ? (
          <ChipSkeleton />
        ) : topGenres.length === 0 ? (
          <EmptyText>{t("topGenresEmpty")}</EmptyText>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {topGenres.slice(0, 3).map((genre) => (
              <li
                className="inline-flex items-center rounded-full border border-border bg-tag px-2.5 py-0.5 text-xs font-medium text-tag-foreground"
                key={genre.key}
              >
                {genre.name}
              </li>
            ))}
          </ul>
        )}
      </SidebarBlock>

      <SidebarBlock title={t("topTags")}>
        {isLoading ? (
          <ChipSkeleton />
        ) : topTags.length === 0 ? (
          <EmptyText>{t("topTagsEmpty")}</EmptyText>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {topTags.slice(0, 3).map((tag) => (
              <li
                className="inline-flex items-center gap-1 rounded-full border border-border bg-tag px-2.5 py-0.5 text-xs font-medium text-tag-foreground"
                key={tag.id}
              >
                <UiIcon className="text-icon" name="tag" size={12} />
                {tag.name}
              </li>
            ))}
          </ul>
        )}
      </SidebarBlock>

      <SidebarBlock title={t("recentlyAdded")}>
        {isLoading ? (
          <RowSkeleton />
        ) : recentlyAdded.length === 0 ? (
          <EmptyText>{t("recentlyAddedEmpty")}</EmptyText>
        ) : (
          <ul className="flex flex-col gap-1">
            {recentlyAdded.slice(0, 3).map((book) => (
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
        )}
      </SidebarBlock>
    </aside>
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

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex flex-col gap-1 px-2" key={index}>
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function SidebarBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
