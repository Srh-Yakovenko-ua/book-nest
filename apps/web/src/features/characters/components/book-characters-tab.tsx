"use client";

import type { BookView, CharacterSummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import { useBookCharacterSummary } from "../api/use-book-character-summary";
import { useBookCharactersInfinite } from "../api/use-book-characters-infinite";
import { useUnlinkCharacter } from "../api/use-unlink-character";
import { getCharacterDetailsPath } from "../model/character-routes";
import { toCharacterReadingContext } from "../model/characters-roster-query";
import { useCharactersRosterQuery } from "../model/use-characters-roster-query";
import { AddCharacterDialog } from "./add-character-dialog";
import { CharacterCard } from "./character-card";
import { CharacterCardSkeleton } from "./character-card-skeleton";
import { CharacterCommandPalette } from "./character-command-palette";
import { CharactersEmptyState, CharactersNoResults } from "./characters-empty-state";
import { CharactersErrorState } from "./characters-error-state";
import { CharactersToolbar } from "./characters-toolbar";
import { UnlinkCharacterDialog } from "./unlink-character-dialog";

const SKELETON_COUNT = 6;

type BookCharactersTabProps = {
  book: BookView;
};

type RosterListProps = {
  bookId: string;
  characters: ReturnType<typeof useBookCharactersInfinite>;
  hasActiveSearch: boolean;
  hasError: boolean;
  items: CharacterSummaryView[];
  onAdd: () => void;
  onClearSearch: () => void;
  onUnlink: (characterId: string) => void;
};

export function BookCharactersTab({ book }: BookCharactersTabProps) {
  const bookId = book.id;
  const locale = useLocale();
  const t = useTranslations("characters");
  const tToast = useTranslations("characters.toast");

  const readingContext = toCharacterReadingContext(book);
  const roster = useCharactersRosterQuery(readingContext);
  const characters = useBookCharactersInfinite(bookId, roster.listParams);
  const summary = useBookCharacterSummary(bookId, readingContext);
  const unlinkCharacter = useUnlinkCharacter();
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [unlinkId, setUnlinkId] = useState<null | string>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const rosterItems = (characters.data?.pages ?? []).flatMap((page) => page.items);
  const hasRosterError = characters.isError && !characters.isFetchNextPageError;
  const isEmptyBook =
    characters.data !== undefined && rosterItems.length === 0 && !roster.hasActiveSearch;
  const showControls = characters.data !== undefined && !hasRosterError && !isEmptyBook;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openDetails(characterId: string) {
    router.push(getCharacterDetailsPath({ bookId, characterId }));
  }

  function confirmUnlink() {
    if (unlinkId === null) return;
    unlinkCharacter.mutate(
      { bookId, characterId: unlinkId },
      {
        onError: () => toast.error(tToast("unlinkError")),
        onSuccess: () => {
          toast.success(tToast("unlinked"));
          setUnlinkId(null);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {showControls && summary.data !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {t("summary.characters", {
              count: formatNumber(summary.data.totalVisibleCharacters, locale),
            })}
          </Badge>
          <Badge variant="secondary">
            {t("summary.favorites", { count: formatNumber(summary.data.favoritesCount, locale) })}
          </Badge>
          <Badge variant="secondary">
            {t("summary.pov", { count: formatNumber(summary.data.povCount, locale) })}
          </Badge>
          {summary.data.hasHiddenRecords ? (
            <Badge variant="warning">
              <UiIcon name="lock" size={12} />
              {t("summary.hidden")}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {showControls ? (
        <CharactersToolbar
          onAdd={() => setAddOpen(true)}
          onSearch={roster.setSearch}
          onSortChange={roster.setSort}
          search={roster.state.characterSearch}
          sort={roster.state.characterSort}
        />
      ) : null}

      <RosterList
        bookId={bookId}
        characters={characters}
        hasActiveSearch={roster.hasActiveSearch}
        hasError={hasRosterError}
        items={rosterItems}
        onAdd={() => setAddOpen(true)}
        onClearSearch={roster.clearSearch}
        onUnlink={setUnlinkId}
      />

      <AddCharacterDialog
        book={book}
        onOpenChange={setAddOpen}
        onOpenDetails={openDetails}
        open={addOpen}
        readingContext={readingContext}
      />

      <UnlinkCharacterDialog
        isUnlinking={unlinkCharacter.isPending}
        onConfirm={confirmUnlink}
        onOpenChange={(open) => {
          if (!open) setUnlinkId(null);
        }}
        open={unlinkId !== null}
      />

      <CharacterCommandPalette
        bookId={bookId}
        onOpenChange={setPaletteOpen}
        onSelect={openDetails}
        open={paletteOpen}
        readingContext={readingContext}
      />
    </div>
  );
}

function RosterList({
  bookId,
  characters,
  hasActiveSearch,
  hasError,
  items,
  onAdd,
  onClearSearch,
  onUnlink,
}: RosterListProps) {
  const t = useTranslations("characters.states");

  if (hasError) {
    return (
      <div aria-live="assertive" role="alert">
        <CharactersErrorState onRetry={() => void characters.refetch()} />
      </div>
    );
  }

  if (characters.isPending) {
    return (
      <div aria-busy className="grid gap-4 md:grid-cols-2" role="status">
        <span className="sr-only">{t("loading")}</span>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <CharacterCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0 && !hasActiveSearch) {
    return <CharactersEmptyState onAdd={onAdd} />;
  }

  if (items.length === 0) {
    return <CharactersNoResults onClear={onClearSearch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((character) => (
          <li className="flex" key={character.id}>
            <CharacterCard
              bookId={bookId}
              character={character}
              onUnlink={() => onUnlink(character.characterId)}
            />
          </li>
        ))}
      </ul>

      <InfiniteScrollFooter
        errorLabel={t("loadMoreError")}
        onLoadMore={() => void characters.fetchNextPage()}
        state={toLoadMoreState(characters)}
      />
    </div>
  );
}

function toLoadMoreState(characters: RosterListProps["characters"]): InfiniteScrollState {
  if (characters.isFetchNextPageError) return "error";
  if (characters.isFetchingNextPage) return "loading";
  return characters.hasNextPage ? "idle" : "none";
}
