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

export function AddBookToSeriesDialog({
  defaultPartNumber,
  onOpenChange,
  open,
  seriesId,
}: AddBookToSeriesDialogProps) {
  const t = useTranslations("series.addBookDialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <AddBookForm
            defaultPartNumber={defaultPartNumber}
            onDone={() => onOpenChange(false)}
            seriesId={seriesId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddBookForm({
  defaultPartNumber,
  onDone,
  seriesId,
}: {
  defaultPartNumber: number;
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

  const { data: books, isPending } = useSoloBooks(debouncedSearch);
  const linkBook = useUpdateBook(selectedBookId ?? "");

  const results = books ?? [];
  const createHref = `/books/new?seriesId=${seriesId}&partNumber=${partNumber}`;

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
        isPending={isPending}
        onSelect={setSelectedBookId}
        readingLabel={(status) => tReading(status)}
        results={results}
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
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
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
  );
}

function BookResults({
  emptyHref,
  isPending,
  onSelect,
  readingLabel,
  results,
  selectedBookId,
}: {
  emptyHref: string;
  isPending: boolean;
  onSelect: (id: string) => void;
  readingLabel: (status: BookView["readingStatus"]) => string;
  results: BookView[];
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
    <RadioGroup
      aria-label={t("selectBook")}
      className="max-h-64 gap-2 overflow-y-auto pr-1"
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
  );
}
