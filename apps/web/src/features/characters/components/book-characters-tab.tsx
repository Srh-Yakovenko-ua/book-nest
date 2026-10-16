"use client";

import type { BookCharacterRosterItem, BookView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import { useBookCharacterSummary } from "../api/use-book-character-summary";
import { useBookCharactersInfinite } from "../api/use-book-characters-infinite";
import { useUnlinkCharacter } from "../api/use-unlink-character";
import { getCharacterDetailsPath } from "../model/character-routes";
import { toCharacterBookContext } from "../model/characters-roster-query";
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

const ROSTER_GRID = "grid grid-cols-1 gap-4 @2xl/roster:grid-cols-2";

type BookCharactersTabProps = {
  book: BookView;
};

type RosterListProps = {
  bookId: string;
  characters: ReturnType<typeof useBookCharactersInfinite>;
  hasActiveCriteria: boolean;
  hasError: boolean;
  items: BookCharacterRosterItem[];
  onAdd: () => void;
  onClearCriteria: () => void;
  onUnlink: (characterId: string) => void;
};

export function BookCharactersTab({ book }: BookCharactersTabProps) {
  const bookId = book.id;
  const locale = useLocale();
  const t = useTranslations("characters");
  const tToast = useTranslations("characters.toast");

  const bookContext = toCharacterBookContext(book);
  const roster = useCharactersRosterQuery(bookContext);
  const characters = useBookCharactersInfinite(bookId, roster.listParams);
  const summary = useBookCharacterSummary(bookId, bookContext);
  const unlinkCharacter = useUnlinkCharacter();
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [unlinkId, setUnlinkId] = useState<null | string>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const rosterStartRef = useRef<HTMLDivElement>(null);
  const rosterCriteriaKey = JSON.stringify(roster.listParams);
  const previousCriteriaKey = useRef(rosterCriteriaKey);

  const rosterItems = (characters.data?.pages ?? []).flatMap((page) => page.items);
  const hasLoadedRoster = characters.data !== undefined;
  const hasRosterError = characters.isError && !hasLoadedRoster;
  const isEmptyBook =
    hasLoadedRoster &&
    !characters.isPlaceholderData &&
    rosterItems.length === 0 &&
    !roster.hasActiveCriteria;
  const showControls = !isEmptyBook && (hasLoadedRoster || roster.hasActiveCriteria);

  useEffect(() => {
    if (previousCriteriaKey.current === rosterCriteriaKey) return;
    previousCriteriaKey.current = rosterCriteriaKey;
    const rosterStart = rosterStartRef.current;
    if (rosterStart !== null && rosterStart.getBoundingClientRect().top < 0) {
      rosterStart.scrollIntoView({ block: "start" });
    }
  }, [rosterCriteriaKey]);

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
    <div className="@container/roster flex scroll-mt-4 flex-col gap-5" ref={rosterStartRef}>
      {showControls && summary.data !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {t("summary.favorites", { count: formatNumber(summary.data.favoritesCount, locale) })}
          </Badge>
          <Badge variant="secondary">
            {t("summary.pov", { count: formatNumber(summary.data.povCount, locale) })}
          </Badge>
        </div>
      ) : null}

      {showControls ? <CharactersToolbar onAdd={() => setAddOpen(true)} roster={roster} /> : null}

      <RosterList
        bookId={bookId}
        characters={characters}
        hasActiveCriteria={roster.hasActiveCriteria}
        hasError={hasRosterError}
        items={rosterItems}
        onAdd={() => setAddOpen(true)}
        onClearCriteria={roster.clearSearchAndFilters}
        onUnlink={setUnlinkId}
      />

      <AddCharacterDialog
        book={book}
        bookContext={bookContext}
        onOpenChange={setAddOpen}
        onOpenDetails={openDetails}
        open={addOpen}
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
        bookContext={bookContext}
        bookId={bookId}
        onOpenChange={setPaletteOpen}
        onSelect={openDetails}
        open={paletteOpen}
      />
    </div>
  );
}

function RosterList({
  bookId,
  characters,
  hasActiveCriteria,
  hasError,
  items,
  onAdd,
  onClearCriteria,
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

  if (characters.isPending || characters.isPlaceholderData) {
    return (
      <div aria-busy className={ROSTER_GRID} role="status">
        <span className="sr-only">{t("loading")}</span>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <CharacterCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0 && !hasActiveCriteria) {
    return <CharactersEmptyState onAdd={onAdd} />;
  }

  if (items.length === 0) {
    return <CharactersNoResults onClear={onClearCriteria} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className={ROSTER_GRID}>
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
  if (!characters.hasNextPage) return "none";
  return characters.isFetching ? "loading" : "idle";
}
