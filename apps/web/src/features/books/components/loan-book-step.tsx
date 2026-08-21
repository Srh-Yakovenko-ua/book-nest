"use client";

import type { BookView, LoanDirection, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Link } from "@/i18n/navigation";

import { useLoanCandidateBooks } from "../api/use-loan-candidate-books";
import { BookThumb } from "./book-picker";

const SEARCH_DEBOUNCE_MS = 250;

type LoanBookStepProps = {
  direction: LoanDirection;
  onCancel: () => void;
  onNext: () => void;
  onSearchChange: (search: string) => void;
  onSelect: (book: BookView) => void;
  personName: string;
  search: string;
  selectedBookId: Nullable<string>;
};

export function LoanBookStep({
  direction,
  onCancel,
  onNext,
  onSearchChange,
  onSelect,
  personName,
  search,
  selectedBookId,
}: LoanBookStepProps) {
  const t = useTranslations("books.details.loan.bookStep");
  const tActions = useTranslations("books.actions");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const books = useLoanCandidateBooks({ direction, search: debouncedSearch });

  const results = books.data ?? [];
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: books.hasNextPage,
    isFetchingNextPage: books.isFetchingNextPage,
    itemCount: results.length,
    onLoadMore: books.fetchNextPage,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(`${direction}.title`)}</DialogTitle>
        <DialogDescription>{t(`${direction}.description`, { name: personName })}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="loan-book-search">{t("searchLabel")}</Label>
        <Input
          autoComplete="off"
          id="loan-book-search"
          isClearable
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
          placeholder={t("searchPlaceholder")}
          value={search}
        />
      </div>

      <BookResults
        direction={direction}
        isError={books.isError}
        isPending={books.isPending}
        onCancel={onCancel}
        onScroll={onScroll}
        onSelect={onSelect}
        results={results}
        scrollRef={scrollRef}
        searched={debouncedSearch.trim().length > 0}
        selectedBookId={selectedBookId}
      />

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={selectedBookId === null} onClick={onNext} type="button">
          {t("next")}
          <UiIcon name="arrow-right" size={16} />
        </Button>
      </DialogFooter>
    </>
  );
}

function BookResults({
  direction,
  isError,
  isPending,
  onCancel,
  onScroll,
  onSelect,
  results,
  scrollRef,
  searched,
  selectedBookId,
}: {
  direction: LoanDirection;
  isError: boolean;
  isPending: boolean;
  onCancel: () => void;
  onScroll: () => void;
  onSelect: (book: BookView) => void;
  results: BookView[];
  scrollRef: (element: HTMLDivElement | null) => void;
  searched: boolean;
  selectedBookId: Nullable<string>;
}) {
  const t = useTranslations("books.details.loan.bookStep");

  if (isPending) {
    return (
      <p
        aria-busy
        className="grid h-40 place-items-center text-sm text-muted-foreground"
        role="status"
      >
        {t("searching")}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="grid h-40 place-items-center text-sm text-muted-foreground" role="alert">
        {t("loadError")}
      </p>
    );
  }

  if (results.length === 0 && searched) {
    return (
      <p className="grid h-40 place-items-center text-sm text-muted-foreground">{t("notFound")}</p>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink">{t(`${direction}.emptyTitle`)}</p>
        <p className="text-xs text-muted-foreground">{t(`${direction}.emptyHint`)}</p>
        <Button asChild size="sm" variant="secondary">
          <Link href="/books/new" onClick={onCancel}>
            <UiIcon name="plus" size={16} />
            {t("createBook")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto pr-1" onScroll={onScroll} ref={scrollRef}>
      <RadioGroup
        aria-label={t("selectBook")}
        className="gap-2"
        onValueChange={(bookId) => {
          const picked = results.find((book) => book.id === bookId);
          if (picked !== undefined) onSelect(picked);
        }}
        value={selectedBookId ?? ""}
      >
        {results.map((book) => (
          <Label
            className="cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 font-normal transition-colors hover:border-accent-border hover:bg-secondary/50"
            htmlFor={`loan-book-${book.id}`}
            key={book.id}
          >
            <RadioGroupItem aria-label={book.title} id={`loan-book-${book.id}`} value={book.id} />
            <BookThumb book={book} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-ink">{book.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                {book.authors.map((author) => author.name).join(", ")}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
