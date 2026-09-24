"use client";

import type { BookCharacterSummaryQuery, BookView } from "@app/shared";
import type { ReactNode } from "react";

import { CHARACTER_NAME_MAX } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/lib/api-errors";

import type { AddCharacterValues } from "../model/add-character-schema";

import { useBookCharacters } from "../api/use-book-characters";
import { useCharacterSuggestions } from "../api/use-character-suggestions";
import { useCreateCharacterInBook } from "../api/use-create-character-in-book";
import { useDuplicateCandidates } from "../api/use-duplicate-candidates";
import {
  ADD_CHARACTER_DESCRIPTION_MAX,
  buildAddCharacterSchema,
  emptyAddCharacterValues,
  toCreateNewCharacterInBook,
  toLinkExistingCharacterInBook,
} from "../model/add-character-schema";
import { rosterDisplayName } from "../model/characters-roster-query";
import { DuplicateCharacterSuggestion } from "./duplicate-character-suggestion";

const SEARCH_MIN_LENGTH = 2;
const IN_BOOK_MATCH_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 300;
const DUPLICATE_DEBOUNCE_MS = 350;

type AddCharacterDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  onOpenDetails: (characterId: string) => void;
  open: boolean;
  readingContext: BookCharacterSummaryQuery;
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {open ? (
          <AddCharacterFlow
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

function AddCharacterDraft({
  book,
  initialName,
  onBack,
  onClose,
  onOpenDetails,
}: {
  book: BookView;
  initialName: string;
  onBack: () => void;
  onClose: () => void;
  onOpenDetails: (characterId: string) => void;
}) {
  const t = useTranslations("characters.add");
  const tErrors = useTranslations("characters.form.errors");
  const tToast = useTranslations("characters.toast");
  const createInBook = useCreateCharacterInBook();

  const form = useForm<AddCharacterValues>({
    defaultValues: emptyAddCharacterValues(initialName),
    mode: "onTouched",
    resolver: zodResolver(
      buildAddCharacterSchema({
        nameRequired: tErrors("nameRequired"),
        nameTooLong: tErrors("nameTooLong", { max: CHARACTER_NAME_MAX }),
      }),
    ),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = form;

  const name = useWatch({ control, name: "name" }).trim();
  const candidates = useDebouncedDuplicates({
    name,
    ...(book.series === null ? {} : { seriesId: book.series.id }),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createInBook.mutateAsync({
        bookId: book.id,
        input: toCreateNewCharacterInBook(values),
      });
      toast.success(tToast("created"));
      onClose();
      onOpenDetails(created.id);
    } catch (error) {
      if (!applyFieldErrors(form, error)) toast.error(tErrors("generic"));
    }
  });

  function linkCandidate(characterId: string) {
    createInBook.mutate(
      { bookId: book.id, input: toLinkExistingCharacterInBook(characterId) },
      {
        onError: () => toast.error(t("linkError")),
        onSuccess: () => {
          toast.success(t("linked"));
          onClose();
        },
      },
    );
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="add-character-name">{t("nameLabel")}</Label>
        <Input
          aria-describedby={errors.name ? "add-character-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="add-character-name"
          maxLength={CHARACTER_NAME_MAX}
          {...register("name")}
        />
        <FieldError error={errors.name} id="add-character-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="add-character-description">{t("descriptionLabel")}</Label>
        <Textarea
          id="add-character-description"
          maxLength={ADD_CHARACTER_DESCRIPTION_MAX}
          placeholder={t("descriptionPlaceholder")}
          rows={3}
          {...register("description")}
        />
      </div>

      {candidates.length > 0 ? (
        <DuplicateCharacterSuggestion
          candidates={candidates}
          onCreateAnyway={() => void onSubmit()}
          onUse={linkCandidate}
        />
      ) : null}

      <DialogFooter>
        <Button onClick={onBack} type="button" variant="secondary">
          <UiIcon name="chevron-left" size={16} />
          {t("back")}
        </Button>
        <Button disabled={createInBook.isPending} loading={createInBook.isPending} type="submit">
          {candidates.length > 0 ? t("createAnyway") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddCharacterFlow({
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
  const [query, setQuery] = useState("");
  const [draftName, setDraftName] = useState<null | string>(null);

  if (draftName === null) {
    return (
      <AddCharacterSearch
        book={book}
        onClose={onClose}
        onCreateNew={() => setDraftName(query.trim())}
        onOpenDetails={onOpenDetails}
        onQueryChange={setQuery}
        query={query}
        readingContext={readingContext}
      />
    );
  }

  return (
    <AddCharacterDraft
      book={book}
      initialName={draftName}
      onBack={() => setDraftName(null)}
      onClose={onClose}
      onOpenDetails={onOpenDetails}
    />
  );
}

function AddCharacterSearch({
  book,
  onClose,
  onCreateNew,
  onOpenDetails,
  onQueryChange,
  query,
  readingContext,
}: {
  book: BookView;
  onClose: () => void;
  onCreateNew: () => void;
  onOpenDetails: (characterId: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
  readingContext: BookCharacterSummaryQuery;
}) {
  const t = useTranslations("characters.add");
  const createInBook = useCreateCharacterInBook();

  const trimmed = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const isSearching = trimmed.length >= SEARCH_MIN_LENGTH;

  const inBook = useBookCharacters(book.id, {
    pageNumber: 1,
    pageSize: IN_BOOK_MATCH_LIMIT,
    sort: "name",
    ...readingContext,
    ...(isSearching ? { search: trimmed } : {}),
  });
  const suggestions = useCharacterSuggestions(book.id, trimmed);

  const inBookMatches = isSearching ? (inBook.data?.items ?? []) : [];
  const reusable = isSearching ? (suggestions.data?.suggestions ?? []) : [];
  const isLoading = isSearching && (inBook.isFetching || suggestions.isFetching);
  const hasNoMatch = isSearching && !isLoading && inBookMatches.length + reusable.length === 0;

  function linkExisting(characterId: string) {
    createInBook.mutate(
      { bookId: book.id, input: toLinkExistingCharacterInBook(characterId) },
      {
        onError: () => toast.error(t("linkError")),
        onSuccess: () => {
          toast.success(t("linked"));
          onClose();
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        aria-label={t("searchLabel")}
        autoComplete="off"
        className="h-10"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        type="search"
        value={query}
      />

      {isLoading && inBookMatches.length + reusable.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : null}

      {inBookMatches.length > 0 ? (
        <CandidateSection title={t("inBookTitle")}>
          {inBookMatches.map((character) => (
            <CandidateRow
              actionLabel={t("open")}
              avatarUrl={(character.portrait ?? character.avatar)?.urls.thumb ?? null}
              key={character.id}
              name={rosterDisplayName(character)}
              onAction={() => {
                onClose();
                onOpenDetails(character.characterId);
              }}
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
              disabled={createInBook.isPending}
              hint={candidate.species}
              key={candidate.id}
              name={candidate.name}
              onAction={() => linkExisting(candidate.id)}
            />
          ))}
        </CandidateSection>
      ) : null}

      {hasNoMatch ? <p className="text-sm text-muted-foreground">{t("noMatch")}</p> : null}

      {isSearching ? null : <p className="text-sm text-muted-foreground">{t("searchHint")}</p>}

      <DialogFooter>
        <Button onClick={onClose} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button onClick={onCreateNew} type="button">
          <UiIcon name="plus" size={16} />
          {t("createNew")}
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
  avatarUrl: null | string;
  disabled?: boolean;
  hint?: null | string;
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

function useDebouncedDuplicates({ name, seriesId }: { name: string; seriesId?: string }) {
  const debouncedName = useDebouncedValue(name, DUPLICATE_DEBOUNCE_MS);
  const duplicates = useDuplicateCandidates({
    name: debouncedName,
    ...(seriesId === undefined ? {} : { seriesId }),
  });

  return debouncedName === name ? (duplicates.data?.candidates ?? []) : [];
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}
