"use client";

import type { BookView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

import { useBookCharacterSummary } from "../api/use-book-character-summary";
import { useBookCharacters } from "../api/use-book-characters";
import { useCreateCharacterInBook } from "../api/use-create-character-in-book";
import { useUnlinkCharacter } from "../api/use-unlink-character";
import { emptyCharacterFormValues, toBookProfileInput } from "../model/character-form-schema";
import { sortRosterPage } from "../model/characters-roster-query";
import { useCharactersRosterQuery } from "../model/use-characters-roster-query";
import { useDeleteCharacterWithUndo } from "../model/use-delete-character-with-undo";
import { CharacterCard } from "./character-card";
import { CharacterCardSkeleton } from "./character-card-skeleton";
import { CharacterCommandPalette } from "./character-command-palette";
import { CharacterDetailsSheet } from "./character-details-sheet";
import { CharacterFormDialog } from "./character-form-dialog";
import { CharactersEmptyState, CharactersNoResults } from "./characters-empty-state";
import { CharactersErrorState } from "./characters-error-state";
import { CharactersToolbar } from "./characters-toolbar";
import { DeleteCharacterDialog } from "./delete-character-dialog";
import { QuickAddCharacterBar } from "./quick-add-character-bar";
import { UnlinkCharacterDialog } from "./unlink-character-dialog";

const SKELETON_COUNT = 6;

type BookCharactersTabProps = {
  book: BookView;
};

type FormState = { characterId?: string; initialName?: string; open: boolean };

type RosterListProps = {
  characters: ReturnType<typeof useBookCharacters>;
  hasActiveSearch: boolean;
  onAdd: () => void;
  onClearSearch: () => void;
  onDelete: (characterId: string) => void;
  onEdit: (characterId: string) => void;
  onOpenDetails: (characterId: string) => void;
  onPageChange: (page: number) => void;
  onUnlink: (characterId: string) => void;
  sort: "name" | "recommended";
};

export function BookCharactersTab({ book }: BookCharactersTabProps) {
  const bookId = book.id;
  const locale = useLocale();
  const t = useTranslations("characters");
  const tToast = useTranslations("characters.toast");
  const tExisting = useTranslations("characters.existing");

  const roster = useCharactersRosterQuery();
  const characters = useBookCharacters(bookId, roster.listParams);
  const summary = useBookCharacterSummary(bookId);
  const createInBook = useCreateCharacterInBook();
  const unlinkCharacter = useUnlinkCharacter();
  const deleteCharacter = useDeleteCharacterWithUndo();

  const [detailsId, setDetailsId] = useState<null | string>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ open: false });
  const [deleteId, setDeleteId] = useState<null | string>(null);
  const [unlinkId, setUnlinkId] = useState<null | string>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    setDetailsId(characterId);
    setDetailsOpen(true);
  }

  function openEdit(characterId: string) {
    setDetailsOpen(false);
    setForm({ characterId, open: true });
  }

  function linkExisting(characterId: string) {
    createInBook.mutate(
      {
        bookId,
        input: {
          bookProfile: toBookProfileInput(emptyCharacterFormValues()),
          characterId,
          mode: "existing",
        },
      },
      {
        onError: () => toast.error(tExisting("linkError")),
        onSuccess: () => {
          toast.success(tExisting("linked"));
          setForm({ open: false });
        },
      },
    );
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

  function confirmDelete() {
    if (deleteId === null) return;
    deleteCharacter.deleteWithUndo(deleteId, () => setDeleteId(null));
  }

  return (
    <div className="flex flex-col gap-5">
      {summary.data === undefined ? null : (
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
      )}

      <QuickAddCharacterBar
        bookId={bookId}
        onLinkExisting={linkExisting}
        onMoreFields={(name) => setForm({ initialName: name, open: true })}
      />

      <CharactersToolbar
        onAdd={() => setForm({ open: true })}
        onOpenPalette={() => setPaletteOpen(true)}
        onSearch={roster.setSearch}
        onSortChange={roster.setSort}
        search={roster.state.characterSearch}
        sort={roster.state.characterSort}
      />

      <RosterList
        characters={characters}
        hasActiveSearch={roster.hasActiveSearch}
        onAdd={() => setForm({ open: true })}
        onClearSearch={roster.clearSearch}
        onDelete={setDeleteId}
        onEdit={openEdit}
        onOpenDetails={openDetails}
        onPageChange={roster.setPage}
        onUnlink={setUnlinkId}
        sort={roster.state.characterSort}
      />

      <CharacterDetailsSheet
        characterId={detailsId}
        contextBookId={bookId}
        onEdit={openEdit}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
      />

      <CharacterFormDialog
        bookId={bookId}
        characterId={form.characterId}
        initialName={form.initialName}
        onLinkExisting={linkExisting}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        open={form.open}
      />

      <DeleteCharacterDialog
        characterId={deleteId}
        isDeleting={deleteCharacter.isPending}
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        open={deleteId !== null}
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
        contextBookId={bookId}
        onOpenChange={setPaletteOpen}
        onSelect={openDetails}
        open={paletteOpen}
      />
    </div>
  );
}

function RosterList({
  characters,
  hasActiveSearch,
  onAdd,
  onClearSearch,
  onDelete,
  onEdit,
  onOpenDetails,
  onPageChange,
  onUnlink,
  sort,
}: RosterListProps) {
  const t = useTranslations("characters.states");

  if (characters.isError) {
    return (
      <div aria-live="assertive" role="alert">
        <CharactersErrorState onRetry={() => void characters.refetch()} />
      </div>
    );
  }

  if (characters.isPending || characters.data === undefined) {
    return (
      <div aria-busy className="grid gap-4 md:grid-cols-2" role="status">
        <span className="sr-only">{t("loading")}</span>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <CharacterCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (characters.data.items.length === 0 && !hasActiveSearch) {
    return <CharactersEmptyState onAdd={onAdd} />;
  }

  if (characters.data.items.length === 0) {
    return <CharactersNoResults onClear={onClearSearch} />;
  }

  const sorted = sortRosterPage(characters.data.items, sort);

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 md:grid-cols-2">
        {sorted.map((character) => (
          <li className="flex" key={character.id}>
            <CharacterCard
              character={character}
              onDelete={() => onDelete(character.characterId)}
              onEdit={() => onEdit(character.characterId)}
              onOpenDetails={() => onOpenDetails(character.characterId)}
              onUnlink={() => onUnlink(character.characterId)}
            />
          </li>
        ))}
      </ul>

      <RosterPagination
        onPageChange={onPageChange}
        page={characters.data.page}
        pagesCount={characters.data.pagesCount}
      />
    </div>
  );
}

function RosterPagination({
  onPageChange,
  page,
  pagesCount,
}: {
  onPageChange: (page: number) => void;
  page: number;
  pagesCount: number;
}) {
  const t = useTranslations("common");

  if (pagesCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        aria-label={t("decrement")}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        size="icon-sm"
        variant="secondary"
      >
        <UiIcon name="chevron-left" size={16} />
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        {page} / {pagesCount}
      </span>
      <Button
        aria-label={t("increment")}
        disabled={page >= pagesCount}
        onClick={() => onPageChange(page + 1)}
        size="icon-sm"
        variant="secondary"
      >
        <UiIcon name="chevron-right" size={16} />
      </Button>
    </div>
  );
}
