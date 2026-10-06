"use client";

import type {
  BookCharacterSummaryQuery,
  BookView,
  CharacterGlobalSummaryView,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { useBookCharacterLookup } from "../api/use-book-characters";
import { useCharacterSuggestions } from "../api/use-character-suggestions";
import { useCreateCharacterInBook } from "../api/use-create-character-in-book";
import { duplicateCandidatesQueryOptions } from "../api/use-duplicate-candidates";
import {
  toCreateNewCharacterInBook,
  toLinkExistingCharacterInBook,
} from "../model/add-character-schema";
import { rosterDisplayName } from "../model/characters-roster-query";
import { DuplicateCharacterSuggestion } from "./duplicate-character-suggestion";

const PICKER = {
  inBookLimit: 5,
  skeletonCount: 2,
  viewport: "h-64 overflow-y-auto pr-1 sm:h-72",
} as const;

type AddCharacterDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  onOpenDetails: (characterId: string) => void;
  open: boolean;
  readingContext: BookCharacterSummaryQuery;
};

type DuplicateWarning = {
  query: string;
  unmatched: CharacterGlobalSummaryView[];
};

export function AddCharacterDialog({
  book,
  onOpenChange,
  onOpenDetails,
  open,
  readingContext,
}: AddCharacterDialogProps) {
  const t = useTranslations("characters.add");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {open ? (
          <AddCharacterPicker
            book={book}
            onClose={() => onOpenChange(false)}
            onOpenDetails={onOpenDetails}
            readingContext={readingContext}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddCharacterPicker({
  book,
  onClose,
  onOpenDetails,
  readingContext,
}: {
  book: BookView;
  onClose: () => void;
  onOpenDetails: (characterId: string) => void;
  readingContext: BookCharacterSummaryQuery;
}) {
  const t = useTranslations("characters.add");
  const tDuplicate = useTranslations("characters.duplicate");
  const tStates = useTranslations("characters.states");
  const tToast = useTranslations("characters.toast");

  const queryClient = useQueryClient();
  const createInBook = useCreateCharacterInBook();

  const [query, setQuery] = useState("");
  const [warning, setWarning] = useState<Nullable<DuplicateWarning>>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const inBook = useBookCharacterLookup({
    bookId: book.id,
    pageSize: PICKER.inBookLimit,
    query,
    readingContext,
  });
  const suggestions = useCharacterSuggestions({ bookId: book.id, query, readingContext });

  const inBookMatches = inBook.data?.items ?? [];
  const reusable = suggestions.data?.suggestions ?? [];
  const shownCandidateIds = new Set([
    ...inBookMatches.map((character) => character.characterId),
    ...reusable.map((candidate) => candidate.id),
  ]);

  const isLoading = inBook.isLoading || suggestions.isLoading;
  const hasLookupError = inBook.isError || suggestions.isError;
  const hasNoMatch = !isLoading && !hasLookupError && shownCandidateIds.size === 0;
  const activeWarning = warning !== null && warning.query === query ? warning : null;
  const isBusy = isCheckingDuplicates || createInBook.isPending;

  function changeQuery(next: string) {
    setWarning(null);
    setQuery(next);
  }

  function openDetails(characterId: string) {
    onClose();
    onOpenDetails(characterId);
  }

  function createCharacter() {
    createInBook.mutate(
      { bookId: book.id, input: toCreateNewCharacterInBook(query) },
      {
        onError: () => toast.error(tToast("createError")),
        onSuccess: () => {
          toast.success(tToast("created"));
          onClose();
        },
      },
    );
  }

  function linkCharacter(characterId: string) {
    createInBook.mutate(
      { bookId: book.id, input: toLinkExistingCharacterInBook(characterId) },
      {
        onError: () => toast.error(t("linkError")),
        onSuccess: () => {
          toast.success(tToast("created"));
          onClose();
        },
      },
    );
  }

  async function requestCreate() {
    setIsCheckingDuplicates(true);
    try {
      const { candidates } = await queryClient.fetchQuery({
        ...duplicateCandidatesQueryOptions({
          name: query,
          ...(book.series === null ? {} : { seriesId: book.series.id }),
        }),
        staleTime: 0,
      });

      if (candidates.length === 0) {
        createCharacter();
        return;
      }

      setWarning({
        query,
        unmatched: candidates.filter((candidate) => !shownCandidateIds.has(candidate.id)),
      });
    } catch {
      toast.error(tDuplicate("checkFailed"));
    } finally {
      setIsCheckingDuplicates(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput
        clearLabel={t("searchClear")}
        label={t("searchLabel")}
        onClear={() => changeQuery("")}
        onSearch={changeQuery}
        placeholder={t("searchPlaceholder")}
        value={query}
      />

      <div className={PICKER.viewport}>
        {query === "" ? (
          <p className="text-sm text-muted-foreground">{t("searchHint")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div aria-busy className="flex flex-col gap-2" role="status">
                <span className="sr-only">{tStates("loading")}</span>
                {Array.from({ length: PICKER.skeletonCount }, (_, index) => (
                  <Skeleton className="h-14 w-full rounded-lg" key={index} />
                ))}
              </div>
            ) : null}

            {hasLookupError ? (
              <p className="text-sm text-error">{tStates("errorDescription")}</p>
            ) : null}

            {activeWarning === null ? null : (
              <DuplicateCharacterSuggestion
                candidates={activeWarning.unmatched}
                isCreating={createInBook.isPending}
                onCreateAnyway={createCharacter}
                onReview={openDetails}
              />
            )}

            {inBookMatches.length > 0 ? (
              <CandidateSection title={t("inBookTitle")}>
                {inBookMatches.map((character) => (
                  <CandidateRow
                    actionLabel={t("open")}
                    avatarUrl={(character.portrait ?? character.avatar)?.urls.thumb ?? null}
                    key={character.id}
                    name={rosterDisplayName(character)}
                    onAction={() => openDetails(character.characterId)}
                    variant="secondary"
                  />
                ))}
              </CandidateSection>
            ) : null}

            {reusable.length > 0 ? (
              <CandidateSection title={t("reusableTitle")}>
                {reusable.map((candidate) => (
                  <CandidateRow
                    actionLabel={t("link")}
                    avatarUrl={candidate.avatar?.urls.thumb ?? null}
                    disabled={isBusy}
                    hint={candidate.species}
                    key={candidate.id}
                    name={candidate.name}
                    onAction={() => linkCharacter(candidate.id)}
                  />
                ))}
              </CandidateSection>
            ) : null}

            {hasNoMatch ? <p className="text-sm text-muted-foreground">{t("noMatch")}</p> : null}

            {activeWarning === null ? (
              <Button
                className="w-full justify-start"
                disabled={isBusy}
                loading={isCheckingDuplicates}
                onClick={() => void requestCreate()}
                type="button"
                variant="secondary"
              >
                <UiIcon name="plus" size={16} />
                {t("createNew", { name: query })}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={onClose} type="button" variant="secondary">
          {t("cancel")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function CandidateRow({
  actionLabel,
  avatarUrl,
  disabled,
  hint,
  name,
  onAction,
  variant,
}: {
  actionLabel: string;
  avatarUrl: Nullable<string>;
  disabled?: boolean;
  hint?: Nullable<string>;
  name: string;
  onAction: () => void;
  variant?: "secondary";
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border p-2.5">
      <Avatar className="size-9" size="sm">
        {avatarUrl === null ? null : <AvatarImage alt={name} src={avatarUrl} />}
        <AvatarFallback>{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        {hint === undefined || hint === null ? null : (
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        )}
      </div>
      <Button disabled={disabled} onClick={onAction} size="sm" type="button" variant={variant}>
        {actionLabel}
      </Button>
    </li>
  );
}

function CandidateSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}
