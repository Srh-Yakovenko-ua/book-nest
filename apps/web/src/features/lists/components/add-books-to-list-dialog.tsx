"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import type { LibraryListParams } from "@/features/books/model/library-query";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { useLibraryBooks } from "@/features/books/api/use-books";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { readingStatuses } from "@/lib/book-status";
import { cn } from "@/lib/utils";

import { useAddBooksToList } from "../api/use-list-membership";

const SEARCH_DEBOUNCE_MS = 250;
const LIBRARY_PAGE_SIZE = 24;

type AddBooksToListDialogProps = {
  listBookIds: string[];
  listId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddBooksToListDialog({
  listBookIds,
  listId,
  onOpenChange,
  open,
}: AddBooksToListDialogProps) {
  const t = useTranslations("lists.addBooks");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <AddBooksForm
            listBookIds={listBookIds}
            listId={listId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddBooksForm({
  listBookIds,
  listId,
  onDone,
}: {
  listBookIds: string[];
  listId: string;
  onDone: () => void;
}) {
  const t = useTranslations("lists.addBooks");
  const tStatus = useTranslations("books.readingStatus.options");
  const tToast = useTranslations("lists.details.toast");
  const tCommon = useTranslations("common");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BookView[]>([]);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const addBooks = useAddBooksToList(listId);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useLibraryBooks(
    libraryParams(debouncedSearch),
  );

  const inListIds = new Set(listBookIds);
  const selectedIds = new Set(selected.map((book) => book.id));
  const results = (data?.pages ?? []).flatMap((page) => page.items);

  function toggle(book: BookView) {
    setSelected((current) =>
      current.some((entry) => entry.id === book.id)
        ? current.filter((entry) => entry.id !== book.id)
        : [...current, book],
    );
  }

  function submit() {
    if (selected.length === 0) return;
    addBooks.mutate(
      { bookIds: selected.map((book) => book.id) },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: (result) => {
          toast.success(t("toast", { count: result.added }));
          onDone();
        },
      },
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="text-sm font-medium text-ink">{t("library")}</h3>
        <div className="relative flex items-center">
          <UiIcon
            aria-hidden
            className="pointer-events-none absolute left-3 text-muted-foreground"
            name="search"
            size={18}
          />
          <Input
            aria-label={t("search")}
            autoComplete="off"
            className="h-10 pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            value={search}
          />
        </div>
        <ScrollArea className="h-72 rounded-lg border border-border">
          <LibraryResults
            alreadyLabel={t("alreadyInList")}
            emptyLabel={t("empty")}
            inListIds={inListIds}
            isPending={isPending}
            loadingLabel={tCommon("loading")}
            onToggle={toggle}
            readingLabel={(status) => tStatus(status)}
            results={results}
            selectedIds={selectedIds}
          />
          {hasNextPage ? (
            <div className="px-2 pb-2">
              <Button
                className="w-full"
                loading={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
                size="sm"
                variant="outline"
              >
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </ScrollArea>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">
            {t("selected", { count: selected.length })}
          </h3>
          {selected.length > 0 ? (
            <Button onClick={() => setSelected([])} size="sm" variant="ghost">
              {t("clear")}
            </Button>
          ) : null}
        </div>
        <ScrollArea className="h-72 rounded-lg border border-border">
          <SelectedBooks
            books={selected}
            emptyLabel={t("emptySelected")}
            onRemove={toggle}
            removeLabel={t("removeSelected")}
          />
        </ScrollArea>
        <Button
          disabled={selected.length === 0 || addBooks.isPending}
          loading={addBooks.isPending}
          onClick={submit}
        >
          {t("submit")}
        </Button>
      </section>
    </div>
  );
}

function BookThumb({ book }: { book: BookView }) {
  if (book.cover === null || book.cover === undefined) {
    return (
      <span className="grid h-12 w-9 shrink-0 place-items-center rounded-sm bg-accent text-icon">
        <UiIcon name="book" size={16} />
      </span>
    );
  }

  return (
    <Image
      alt={book.title}
      className="h-12 w-9 shrink-0 rounded-sm object-cover"
      height={48}
      src={book.cover.urls.thumb}
      unoptimized
      width={36}
    />
  );
}

function libraryParams(search: string): LibraryListParams {
  const q = search.trim();
  return {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    language: [],
    owner: [],
    pageSize: LIBRARY_PAGE_SIZE,
    publisher: [],
    status: [],
    tag: [],
    ...(q === "" ? {} : { q }),
  };
}

function LibraryResults({
  alreadyLabel,
  emptyLabel,
  inListIds,
  isPending,
  loadingLabel,
  onToggle,
  readingLabel,
  results,
  selectedIds,
}: {
  alreadyLabel: string;
  emptyLabel: string;
  inListIds: Set<string>;
  isPending: boolean;
  loadingLabel: string;
  onToggle: (book: BookView) => void;
  readingLabel: (status: BookView["readingStatus"]) => string;
  results: BookView[];
  selectedIds: Set<string>;
}) {
  if (isPending) {
    return (
      <p className="grid h-full place-items-center p-4 text-sm text-muted-foreground">
        {loadingLabel}
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="grid h-full place-items-center p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1 p-2">
      {results.map((book) => {
        const inList = inListIds.has(book.id);
        const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
        return (
          <li key={book.id}>
            <label
              className={cn(
                "flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors",
                inList
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:border-accent-border hover:bg-secondary/50",
              )}
            >
              <Checkbox
                checked={inList || selectedIds.has(book.id)}
                disabled={inList}
                onCheckedChange={() => onToggle(book)}
              />
              <BookThumb book={book} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-ink">{book.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {book.authors.map((author) => author.name).join(", ")}
                </span>
              </div>
              {inList ? (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {alreadyLabel}
                </span>
              ) : readingBase === undefined ? null : (
                <StatusBadge
                  className="shrink-0"
                  entry={{ ...readingBase, label: readingLabel(book.readingStatus) }}
                />
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function SelectedBooks({
  books,
  emptyLabel,
  onRemove,
  removeLabel,
}: {
  books: BookView[];
  emptyLabel: string;
  onRemove: (book: BookView) => void;
  removeLabel: string;
}) {
  if (books.length === 0) {
    return (
      <p className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1 p-2">
      {books.map((book) => (
        <li
          className="flex items-center gap-3 rounded-lg border border-transparent p-2"
          key={book.id}
        >
          <BookThumb book={book} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-ink">{book.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {book.authors.map((author) => author.name).join(", ")}
            </span>
          </div>
          <button
            aria-label={removeLabel}
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => onRemove(book)}
            type="button"
          >
            <UiIcon name="x" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}
