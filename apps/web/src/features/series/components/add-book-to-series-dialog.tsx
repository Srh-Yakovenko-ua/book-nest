"use client";

import type { BookView } from "@app/shared";

import {
  BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
  BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
} from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Link } from "@/i18n/navigation";
import { readingStatuses } from "@/lib/book-status";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { useSoloBooks } from "../api/use-solo-books";

const SEARCH_DEBOUNCE_MS = 250;
const PART_NUMBER_MIN = 1;
const PART_NUMBER_MAX = 999;

type AddBookToSeriesDialogProps = {
  defaultPartNumber: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  seriesId: string;
};

const choiceCardClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-accent-border focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none";

export function AddBookToSeriesDialog({
  defaultPartNumber,
  onOpenChange,
  open,
  seriesId,
}: AddBookToSeriesDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <AddBookFlow
            defaultPartNumber={defaultPartNumber}
            onDone={() => onOpenChange(false)}
            seriesId={seriesId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddBookFlow({
  defaultPartNumber,
  onDone,
  seriesId,
}: {
  defaultPartNumber: number;
  onDone: () => void;
  seriesId: string;
}) {
  const [step, setStep] = useState<"choose" | "search">("choose");

  if (step === "choose") {
    return (
      <ChooseStep
        defaultPartNumber={defaultPartNumber}
        onSearch={() => setStep("search")}
        seriesId={seriesId}
      />
    );
  }

  return (
    <AddBookForm
      defaultPartNumber={defaultPartNumber}
      onBack={() => setStep("choose")}
      onDone={onDone}
      seriesId={seriesId}
    />
  );
}

function AddBookForm({
  defaultPartNumber,
  onBack,
  onDone,
  seriesId,
}: {
  defaultPartNumber: number;
  onBack: () => void;
  onDone: () => void;
  seriesId: string;
}) {
  const t = useTranslations("series.addBookDialog");
  const tReading = useTranslations("books.readingStatus.options");
  const tToast = useTranslations("series.toast");

  const [search, setSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<null | string>(null);
  const [partNumber, setPartNumber] = useState(defaultPartNumber);
  const [partError, setPartError] = useState<null | string>(null);
  const [serverError, setServerError] = useState<null | string>(null);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const {
    data: books,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
  } = useSoloBooks(debouncedSearch);
  const linkBook = useUpdateBook(selectedBookId ?? "");

  const results = books ?? [];
  const createHref = `/books/new?seriesId=${seriesId}&partNumber=${partNumber}`;
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: results.length,
    onLoadMore: fetchNextPage,
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedBookId === null) return;
    setPartError(null);
    setServerError(null);
    linkBook.mutate(
      { bookType: "series_part", partNumber, seriesId },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors) {
            const taken = error.fieldErrors.find(
              (field) => field.code === BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
            );
            if (taken) {
              setPartError(t("partNumberTaken"));
              return;
            }
            const exceeds = error.fieldErrors.find(
              (field) =>
                field.field === "partNumber" &&
                field.message === BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
            );
            if (exceeds) {
              setPartError(t("partNumberExceedsTotal"));
              return;
            }
          }
          setServerError(t("genericError"));
        },
        onSuccess: () => {
          toast.success(tToast("bookAdded"));
          onDone();
        },
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <button
          className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <UiIcon aria-hidden name="arrow-left" size={16} />
          {t("back")}
        </button>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="add-book-search">{t("searchLabel")}</Label>
          <div className="relative flex items-center">
            <UiIcon
              aria-hidden
              className="pointer-events-none absolute left-3 text-muted-foreground"
              name="search"
              size={18}
            />
            <Input
              autoComplete="off"
              className="h-10 pl-10"
              id="add-book-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              value={search}
            />
          </div>
        </div>

        <BookResults
          emptyHref={createHref}
          isFetchingNextPage={isFetchingNextPage}
          isPending={isPending}
          onScroll={onScroll}
          onSelect={setSelectedBookId}
          readingLabel={(status) => tReading(status)}
          results={results}
          scrollRef={scrollRef}
          selectedBookId={selectedBookId}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="add-book-part-number">{t("partNumber")}</Label>
          <NumberStepper
            describedBy={partError ? "add-book-part-number-error" : undefined}
            id="add-book-part-number"
            max={PART_NUMBER_MAX}
            min={PART_NUMBER_MIN}
            onValueChange={setPartNumber}
            size="sm"
            value={partNumber}
          />
          {partError === null ? null : (
            <p className="text-xs text-destructive" id="add-book-part-number-error" role="alert">
              {partError}
            </p>
          )}
        </div>

        {serverError === null ? null : (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {serverError}
          </p>
        )}

        <DialogFooter>
          <Button onClick={onDone} type="button" variant="secondary">
            {t("cancel")}
          </Button>
          <Button
            disabled={selectedBookId === null || linkBook.isPending}
            loading={linkBook.isPending}
            type="submit"
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function BookResults({
  emptyHref,
  isFetchingNextPage,
  isPending,
  onScroll,
  onSelect,
  readingLabel,
  results,
  scrollRef,
  selectedBookId,
}: {
  emptyHref: string;
  isFetchingNextPage: boolean;
  isPending: boolean;
  onScroll: () => void;
  onSelect: (id: string) => void;
  readingLabel: (status: BookView["readingStatus"]) => string;
  results: BookView[];
  scrollRef: (el: HTMLDivElement | null) => void;
  selectedBookId: null | string;
}) {
  const t = useTranslations("series.addBookDialog");

  if (isPending) {
    return (
      <p className="grid h-40 place-items-center text-sm text-muted-foreground">{t("searching")}</p>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink">{t("empty")}</p>
        <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        <Button asChild size="sm" variant="secondary">
          <Link href={emptyHref}>
            <UiIcon name="plus" size={16} />
            {t("createNew")}
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
        onValueChange={onSelect}
        value={selectedBookId ?? ""}
      >
        {results.map((book) => {
          const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
          const authorsLine = book.authors.map((author) => author.name).join(", ");
          return (
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-accent-border",
                selectedBookId === book.id && "border-primary ring-1 ring-primary",
              )}
              key={book.id}
            >
              <RadioGroupItem value={book.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-ink">{book.title}</span>
                {authorsLine.length > 0 ? (
                  <span className="truncate text-xs text-muted-foreground">{authorsLine}</span>
                ) : null}
              </div>
              {readingBase === undefined ? null : (
                <StatusBadge
                  className="shrink-0"
                  entry={{ ...readingBase, label: readingLabel(book.readingStatus) }}
                />
              )}
            </label>
          );
        })}
      </RadioGroup>
      {isFetchingNextPage ? (
        <div className="px-3 py-2 text-center text-xs text-muted-foreground">{t("searching")}</div>
      ) : null}
    </div>
  );
}

function ChooseStep({
  defaultPartNumber,
  onSearch,
  seriesId,
}: {
  defaultPartNumber: number;
  onSearch: () => void;
  seriesId: string;
}) {
  const t = useTranslations("series.addBookDialog");
  const createHref = `/books/new?seriesId=${seriesId}&partNumber=${defaultPartNumber}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("chooseTitle")}</DialogTitle>
        <DialogDescription>{t("chooseDescription")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <button className={choiceCardClass} onClick={onSearch} type="button">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-icon">
            <UiIcon aria-hidden name="search" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-ink">{t("optionSearchTitle")}</span>
            <span className="text-xs text-muted-foreground">{t("optionSearchSubtitle")}</span>
          </span>
          <UiIcon
            aria-hidden
            className="shrink-0 text-muted-foreground"
            name="chevron-right"
            size={18}
          />
        </button>

        <Link className={choiceCardClass} href={createHref}>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-icon">
            <UiIcon aria-hidden name="sparkles" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-ink">{t("optionCreateTitle")}</span>
            <span className="text-xs text-muted-foreground">{t("optionCreateSubtitle")}</span>
          </span>
          <UiIcon
            aria-hidden
            className="shrink-0 text-muted-foreground"
            name="chevron-right"
            size={18}
          />
        </Link>
      </div>
    </>
  );
}
