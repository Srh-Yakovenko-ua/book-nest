"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibraryListParams } from "@/features/books/model/library-query";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLibraryBooks } from "@/features/books/api/use-books";
import {
  BOOK_PICKER_SCROLL_AREA,
  BookPickerResults,
  BookPickerSelected,
} from "@/features/books/components/book-picker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import { useAddBooksToList } from "../api/use-list-membership";

const SEARCH_DEBOUNCE_MS = 250;
const LIBRARY_PAGE_SIZE = 24;

type AddBooksToListDialogProps = {
  listId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddBooksToListDialog({ listId, onOpenChange, open }: AddBooksToListDialogProps) {
  const t = useTranslations("lists.addBooks");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        {open ? <AddBooksForm listId={listId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddBooksForm({ listId }: { listId: string }) {
  const t = useTranslations("lists.addBooks");
  const tStatus = useTranslations("books.readingStatus.options");
  const tToast = useTranslations("lists.details.toast");
  const tCommon = useTranslations("common");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BookView[]>([]);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const addBooks = useAddBooksToList(listId);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useLibraryBooks(
    libraryParams({ listId, search: debouncedSearch }),
  );

  const selectedIds = new Set(selected.map((book) => book.id));
  const results = (data?.pages ?? []).flatMap((page) => page.items);
  const unselectedResults = results.filter((book) => !selectedIds.has(book.id));

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
          setSelected([]);
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
        {results.length === 0 ? null : (
          <Button
            className="self-start"
            disabled={unselectedResults.length === 0}
            onClick={() => setSelected((current) => [...current, ...unselectedResults])}
            size="sm"
            variant="ghost"
          >
            <UiIcon name="check-check" size={16} />
            {t("selectLoaded", { count: results.length })}
          </Button>
        )}
        <ScrollArea className={cn("h-72", BOOK_PICKER_SCROLL_AREA)}>
          <BookPickerResults
            emptyLabel={t("empty")}
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
        <ScrollArea className={cn("h-72", BOOK_PICKER_SCROLL_AREA)}>
          <BookPickerSelected
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

function libraryParams({ listId, search }: { listId: string; search: string }): LibraryListParams {
  const q = search.trim();
  return {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    language: [],
    notInList: listId,
    owner: [],
    pageSize: LIBRARY_PAGE_SIZE,
    publisher: [],
    status: [],
    tag: [],
    ...(q === "" ? {} : { q }),
  };
}
