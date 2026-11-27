"use client";

import type { BookView, Nullable } from "@app/shared";
import type { FormEvent } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { BookCoverFallback } from "@/components/book-cover-fallback";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import { BooksControllerListSort } from "@/shared/api/generated/model";

import type { QueuePickerItem } from "../model/queue-placement";

import { useLibraryBooks } from "../api/use-books";
import { useAddToReadingQueue, useReadingQueueSummary } from "../api/use-reading-queue";
import { BOOK_CREATE_PATH } from "../model/book-create-href";
import { libraryListParams } from "../model/library-query";
import { useAddToQueueForm } from "../model/use-add-to-queue-form";
import { QueuePositionField } from "./queue-position-field";

const PICKER_PAGE_SIZE = 20;
const PICKER_SKELETON_COUNT = 4;

type AddBookToQueueDialogProps = {
  onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  queueItems: QueuePickerItem[];
};

type PickerNoticeCopy = {
  action: string;
  message: string;
};

type QueuePickerNotice = "allQueued" | "noBooks";

export function AddBookToQueueDialog({
  onCloseAutoFocus,
  onOpenChange,
  open,
  queueItems,
}: AddBookToQueueDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        {open ? (
          <AddBookToQueueForm onDone={() => onOpenChange(false)} queueItems={queueItems} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddBookToQueueForm({
  onDone,
  queueItems,
}: {
  onDone: () => void;
  queueItems: QueuePickerItem[];
}) {
  const t = useTranslations("readingQueue.add");
  const tBooks = useTranslations("books");
  const tLibrary = useTranslations("books.library");
  const add = useAddToReadingQueue();
  const queueSummary = useReadingQueueSummary();
  const form = useAddToQueueForm({ queueItems });

  const [selectedBookId, setSelectedBookId] = useState<null | string>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim();

  const listParams = libraryListParams({
    pageSize: PICKER_PAGE_SIZE,
    sort: BooksControllerListSort.title_asc,
    ...(query === "" ? {} : { q: query }),
  });
  const books = useLibraryBooks(listParams);
  const items: BookView[] = (books.data?.pages ?? []).flatMap((page) => page.items);
  const notice = queuePickerNotice({
    libraryTotal:
      query === "" && !books.isPlaceholderData ? books.data?.pages[0]?.totalCount : undefined,
    queuedTotal: queueSummary.data?.totalCount,
  });
  const noticeCopy = {
    allQueued: { action: t("addNewBook"), message: t("allQueued") },
    noBooks: { action: tBooks("firstBook.cta"), message: t("noBooks") },
  } satisfies Record<QueuePickerNotice, PickerNoticeCopy>;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedBookId === null) return;
    const input = form.buildInput(selectedBookId);
    if (input === null) return;
    add.mutate(input, {
      onError: (error) => {
        if (isApiErrorStatus(error, HTTP_STATUS.conflict)) {
          toast.error(t("duplicateToast"));
          return;
        }
        toast.error(t("errorToast"));
      },
      onSuccess: () => {
        toast.success(t("successToast"));
        onDone();
      },
    });
  }

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <Input
        aria-label={t("searchLabel")}
        isClearable
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch("")}
        placeholder={t("searchPlaceholder")}
        value={search}
      />

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-1">
        <PickerList
          alreadyLabel={t("alreadyInQueue")}
          emptyLabel={t("empty")}
          errorLabel={t("loadError")}
          isError={books.isError}
          isPending={books.isPending}
          items={items}
          loadingLabel={tLibrary("loading")}
          notice={notice === null ? null : noticeCopy[notice]}
          onSelect={setSelectedBookId}
          selectAria={(title) => t("selectBookAria", { title })}
          selectedBookId={selectedBookId}
        />
        {books.hasNextPage && notice === null ? (
          <div className="p-1.5">
            <Button
              className="w-full"
              disabled={books.isFetchingNextPage}
              loading={books.isFetchingNextPage}
              onClick={() => void books.fetchNextPage()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("loadMore")}
            </Button>
          </div>
        ) : null}
      </div>

      {selectedBookId === null ? null : (
        <QueuePositionField
          candidates={form.relativeCandidates}
          error={form.error}
          idPrefix="add-queue-position"
          maxPosition={form.maxPosition}
          onPlacementChange={form.setPlacement}
          onPositionChange={form.setPosition}
          onRelativeBookChange={form.setRelativeBookId}
          onRelativeSideChange={form.setRelativeSide}
          outcome={form.outcome}
          placement={form.placement}
          position={form.position}
          queueLength={form.queueLength}
          relativeBookId={form.relativeBookId}
          relativeSide={form.relativeSide}
        />
      )}

      <DialogFooter>
        <Button disabled={add.isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={selectedBookId === null || add.isPending || !form.isValid}
          loading={add.isPending}
          type="submit"
        >
          {add.isPending ? t("submitting") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PickerCover({ alt, seed, src }: { alt: string; seed: string; src?: string }) {
  if (src === undefined) {
    return (
      <BookCoverFallback alt={alt} className="aspect-3/4 w-9 rounded-sm" seed={seed} sizes="36px" />
    );
  }

  return (
    <div className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="36px" src={src} unoptimized />
    </div>
  );
}

function PickerList({
  alreadyLabel,
  emptyLabel,
  errorLabel,
  isError,
  isPending,
  items,
  loadingLabel,
  notice,
  onSelect,
  selectAria,
  selectedBookId,
}: {
  alreadyLabel: string;
  emptyLabel: string;
  errorLabel: string;
  isError: boolean;
  isPending: boolean;
  items: BookView[];
  loadingLabel: string;
  notice: Nullable<PickerNoticeCopy>;
  onSelect: (bookId: string) => void;
  selectAria: (title: string) => string;
  selectedBookId: null | string;
}) {
  if (isPending) {
    return (
      <div aria-busy aria-label={loadingLabel} className="flex flex-col gap-1" role="status">
        {Array.from({ length: PICKER_SKELETON_COUNT }, (_, index) => (
          <div className="flex items-center gap-3 px-2 py-2" key={index}>
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="aspect-[3/4] w-9 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="alert">
        {errorLabel}
      </p>
    );
  }

  if (notice !== null) {
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
        <p className="text-sm leading-relaxed text-muted-foreground">{notice.message}</p>
        <Button asChild size="sm" variant="secondary">
          <Link href={BOOK_CREATE_PATH}>
            <UiIcon name="plus" size={14} />
            {notice.action}
          </Link>
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <RadioGroup onValueChange={onSelect} value={selectedBookId ?? ""}>
      {items.map((book) => (
        <Label
          className={cn(
            "cursor-pointer items-center gap-3 rounded-lg px-2 py-2 font-normal transition-colors hover:bg-secondary/60",
            book.isInReadingQueue && "cursor-not-allowed opacity-60 hover:bg-transparent",
          )}
          htmlFor={`picker-${book.id}`}
          key={book.id}
        >
          <RadioGroupItem
            aria-label={
              book.isInReadingQueue
                ? `${selectAria(book.title)}, ${alreadyLabel}`
                : selectAria(book.title)
            }
            disabled={book.isInReadingQueue}
            id={`picker-${book.id}`}
            value={book.id}
          />
          <PickerCover alt={book.title} seed={book.id} src={book.cover?.urls.thumb} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-ink">{book.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {book.authors.map((author) => author.name).join(", ")}
            </span>
          </span>
          {book.isInReadingQueue ? (
            <span className="shrink-0 text-xs text-muted-foreground">{alreadyLabel}</span>
          ) : null}
        </Label>
      ))}
    </RadioGroup>
  );
}

function queuePickerNotice({
  libraryTotal,
  queuedTotal,
}: {
  libraryTotal: number | undefined;
  queuedTotal: number | undefined;
}): Nullable<QueuePickerNotice> {
  if (libraryTotal === undefined) return null;
  if (libraryTotal === 0) return "noBooks";
  if (queuedTotal !== undefined && queuedTotal >= libraryTotal) return "allQueued";
  return null;
}
