"use client";

import { useTranslations } from "next-intl";

import type { LibraryBookLinkComponent } from "../model/library-book";
import type {
  LibraryOverviewBook,
  LibraryOverviewGenre,
  LibraryOverviewTag,
} from "./library-overview-blocks";

import {
  LibraryOverviewSection,
  LibraryRecentlyAddedBlock,
  LibraryTopGenresBlock,
  LibraryTopTagsBlock,
} from "./library-overview-blocks";

type LibrarySummarySidebarProps = {
  isLoading: boolean;
  linkComponent?: LibraryBookLinkComponent;
  recentlyAdded: LibraryOverviewBook[];
  topGenres: LibraryOverviewGenre[];
  topTags: LibraryOverviewTag[];
};

export function LibrarySummarySidebar({
  isLoading,
  linkComponent,
  recentlyAdded,
  topGenres,
  topTags,
}: LibrarySummarySidebarProps) {
  const t = useTranslations("books.library.sidebar");

  return (
    <aside
      aria-label={t("title")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <LibraryOverviewSection className="sidebar-card-leaf" title={t("topGenres")}>
        <LibraryTopGenresBlock genres={topGenres} isLoading={isLoading} />
      </LibraryOverviewSection>

      <LibraryOverviewSection className="sidebar-card-leaf" title={t("topTags")}>
        <LibraryTopTagsBlock isLoading={isLoading} tags={topTags} />
      </LibraryOverviewSection>

      <LibraryOverviewSection className="sidebar-card-leaf" title={t("recentlyAdded")}>
        <LibraryRecentlyAddedBlock
          books={recentlyAdded}
          isLoading={isLoading}
          linkComponent={linkComponent}
        />
      </LibraryOverviewSection>
    </aside>
  );
}
