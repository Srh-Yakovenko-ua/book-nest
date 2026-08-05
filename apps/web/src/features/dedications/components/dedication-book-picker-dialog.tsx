"use client";

import type { BookView } from "@app/shared";
import type { FormEvent } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useDeferredValue, useState } from "react";

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
import { useLibraryBooks } from "@/features/books/api/use-books";
import { type LibraryListParams } from "@/features/books/model/library-query";
import { useRouter } from "@/i18n/navigation";
import { BooksControllerListSort } from "@/shared/api/generated/model";

const PICKER_PAGE_SIZE = 20;
const PICKER_SKELETON_COUNT = 4;

type DedicationBookPickerDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DedicationBookPickerDialog({
  onOpenChange,
  open,
}: DedicationBookPickerDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        {open ? <PickerForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-9 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={15} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="36px" src={src} unoptimized />
    </div>
  );
}

function PickerForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("dedications.picker");
  const router = useRouter();

  const [selectedBookId, setSelectedBookId] = useState<null | string>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim();

  const listParams: LibraryListParams = {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    hasDedication: "false",
    language: [],
    owner: [],
    pageSize: PICKER_PAGE_SIZE,
    publisher: [],
    sort: BooksControllerListSort.title_asc,
    status: [],
    tag: [],
    ...(query === "" ? {} : { q: query }),
  };
  const books = useLibraryBooks(listParams);
  const items: BookView[] = (books.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((book) => (book.dedication ?? "").trim() === "");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedBookId === null) return;
    router.push(`/books/${selectedBookId}/edit?focus=dedication&from=dedications`);
    onDone();
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
          emptyLabel={t("empty")}
          errorLabel={t("loadError")}
          isError={books.isError}
          isPending={books.isPending}
          items={items}
          onSelect={setSelectedBookId}
          selectAria={(title) => t("selectBookAria", { title })}
          selectedBookId={selectedBookId}
        />
        {books.hasNextPage ? (
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

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={selectedBookId === null} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PickerList({
  emptyLabel,
  errorLabel,
  isError,
  isPending,
  items,
  onSelect,
  selectAria,
  selectedBookId,
}: {
  emptyLabel: string;
  errorLabel: string;
  isError: boolean;
  isPending: boolean;
  items: BookView[];
  onSelect: (bookId: string) => void;
  selectAria: (title: string) => string;
  selectedBookId: null | string;
}) {
  if (isPending) {
    return (
      <div aria-busy className="flex flex-col gap-1" role="status">
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

  if (items.length === 0) {
    return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <RadioGroup onValueChange={onSelect} value={selectedBookId ?? ""}>
      {items.map((book) => (
        <Label
          className="cursor-pointer items-center gap-3 rounded-lg px-2 py-2 font-normal transition-colors hover:bg-secondary/60"
          htmlFor={`dedication-picker-${book.id}`}
          key={book.id}
        >
          <RadioGroupItem
            aria-label={selectAria(book.title)}
            id={`dedication-picker-${book.id}`}
            value={book.id}
          />
          <PickerCover alt={book.title} src={book.cover?.urls.thumb} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-ink">{book.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {book.authors.map((author) => author.name).join(", ")}
            </span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}
