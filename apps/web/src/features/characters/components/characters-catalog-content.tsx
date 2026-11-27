"use client";

import type { CharacterCatalogItemView } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { RefreshingRegion } from "@/components/refreshing-region";
import { useLibraryOverview, useLibraryPresence } from "@/features/books";
import { BOOK_CREATE_PATH } from "@/features/books/model/book-create-href";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { useRouter } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

import type { CharactersCatalogState } from "../model/characters-catalog-query";

import { getBookCharactersPath } from "../model/character-routes";
import { CatalogCharacterCard } from "./catalog-character-card";
import { CharacterCardSkeleton } from "./character-card-skeleton";
import { CharactersErrorState } from "./characters-error-state";

type CharactersCatalogContentProps = {
  characters: CharacterCatalogItemView[];
  hasActiveFilters: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  loadMoreState: InfiniteScrollState;
  onClearFilters: () => void;
  onLoadMore: () => void;
  view: CharactersCatalogState["view"];
};

const SKELETON_COUNT = 8;

const CHARACTERS_ENTRY_HREFS = {
  addFirstBook: BOOK_CREATE_PATH,
  library: "/books",
} as const;

type EmptyCatalogBodyProps = {
  retryButtonRef: Ref<HTMLButtonElement>;
  view: CharactersCatalogState["view"];
  withRetryFocus: (onRetry: () => void) => () => void;
};

export function CharactersCatalogContent({
  characters,
  hasActiveFilters,
  isPending,
  isRefreshing,
  loadMoreState,
  onClearFilters,
  onLoadMore,
  view,
}: CharactersCatalogContentProps) {
  const t = useTranslations("characters.catalog");

  if (isPending) {
    return <CatalogSkeleton view={view} />;
  }

  if (characters.length === 0) {
    if (!hasActiveFilters) {
      return <EmptyCatalog view={view} />;
    }
    return (
      <RefreshingRegion isRefreshing={isRefreshing}>
        <NoResults onClear={onClearFilters} />
      </RefreshingRegion>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RefreshingRegion isRefreshing={isRefreshing}>
        <ul className={catalogListClassName(view)}>
          {characters.map((character) => (
            <li className="min-w-0" key={character.id}>
              <CatalogCharacterCard character={character} view={view} />
            </li>
          ))}
        </ul>
      </RefreshingRegion>

      <InfiniteScrollFooter
        errorLabel={t("loadMoreError")}
        onLoadMore={onLoadMore}
        state={loadMoreState}
      />
    </div>
  );
}

export function CharactersCatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div aria-live="assertive" role="alert">
      <CharactersErrorState onRetry={onRetry} />
    </div>
  );
}

function catalogListClassName(view: CharactersCatalogState["view"]) {
  return cn("grid grid-cols-1 gap-4", view === "grid" && "lg:grid-cols-2");
}

function CatalogSkeleton({ view }: { view: CharactersCatalogState["view"] }) {
  return (
    <div aria-busy className={catalogListClassName(view)}>
      {Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
        <CharacterCardSkeleton key={index} />
      ))}
    </div>
  );
}

function EmptyCatalog({ view }: { view: CharactersCatalogState["view"] }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(regionRef);

  return (
    <div className={RETRY_FOCUS_RING.onTarget} ref={regionRef} tabIndex={-1}>
      <EmptyCatalogBody
        retryButtonRef={retryButtonRef}
        view={view}
        withRetryFocus={withRetryFocus}
      />
    </div>
  );
}

function EmptyCatalogBody({ retryButtonRef, view, withRetryFocus }: EmptyCatalogBodyProps) {
  const t = useTranslations("characters.catalog.empty");
  const tBooks = useTranslations("books");
  const tStates = useTranslations("characters.states");
  const router = useRouter();
  const presence = useLibraryPresence();
  const latestBook = useLibraryOverview("all").data?.recentlyAdded[0];

  switch (presence.kind) {
    case "error": {
      const errorState: EmptyStateEntry = {
        desc: tStates("errorDescription"),
        illu: "error-generic",
        primary: { icon: "refresh", label: tStates("retry") },
        title: tStates("errorTitle"),
      };
      return (
        <div aria-live="assertive" role="alert">
          <EmptyState
            onPrimary={withRetryFocus(presence.retry)}
            primaryRef={retryButtonRef}
            state={errorState}
          />
        </div>
      );
    }
    case "pending":
      return <CatalogSkeleton view={view} />;
    case "ready": {
      if (presence.total === 0) {
        const noBooksState: EmptyStateEntry = {
          desc: t("noBooksDescription"),
          illu: "empty-characters",
          primary: { icon: "plus", label: tBooks("firstBook.cta") },
          title: t("title"),
        };
        return (
          <EmptyState
            onPrimary={() => router.push(CHARACTERS_ENTRY_HREFS.addFirstBook)}
            state={noBooksState}
          />
        );
      }
      if (latestBook === undefined) {
        const libraryState: EmptyStateEntry = {
          desc: t("description"),
          illu: "empty-characters",
          primary: { icon: "library", label: t("openLibrary") },
          title: t("title"),
        };
        return (
          <EmptyState
            onPrimary={() => router.push(CHARACTERS_ENTRY_HREFS.library)}
            state={libraryState}
          />
        );
      }
      const hasBooksState: EmptyStateEntry = {
        desc: t("description"),
        illu: "empty-characters",
        primary: { icon: "book", label: t("openLatestBook") },
        secondary: { icon: "library", label: t("openLibrary") },
        title: t("title"),
      };
      return (
        <EmptyState
          onPrimary={() => router.push(getBookCharactersPath(latestBook.id))}
          onSecondary={() => router.push(CHARACTERS_ENTRY_HREFS.library)}
          state={hasBooksState}
        />
      );
    }
    default:
      return assertNever(presence);
  }
}

function NoResults({ onClear }: { onClear: () => void }) {
  const t = useTranslations("characters.catalog.noResults");

  const state: EmptyStateEntry = {
    desc: t("description"),
    illu: "empty-search",
    primary: { icon: "x", label: t("clear") },
    title: t("title"),
  };

  return <EmptyState onPrimary={onClear} state={state} />;
}
