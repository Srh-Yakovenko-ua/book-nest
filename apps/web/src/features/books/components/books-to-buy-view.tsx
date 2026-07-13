"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import {
  BooksControllerListOwnerItem,
  BooksControllerListSort,
} from "@/shared/api/generated/model";

import type { LibraryListParams } from "../model/library-query";

import { useLibraryBooks } from "../api/use-books";
import { DeliveryDialog } from "./delivery-dialog";

const WANT_TO_BUY_PARAMS: LibraryListParams = {
  ageCategory: [],
  author: [],
  format: [],
  genre: [],
  language: [],
  owner: [BooksControllerListOwnerItem.want_to_buy],
  publisher: [],
  sort: BooksControllerListSort.created_desc,
  status: [],
  tag: [],
};

const SKELETON_COUNT = 6;

export function BooksToBuyView() {
  const t = useTranslations("booksToBuy");
  const router = useRouter();
  const { data, isError, isPending, refetch } = useLibraryBooks(WANT_TO_BUY_PARAMS);

  const books = (data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("subtitle")}
        </p>
      </header>

      <BooksToBuyContent
        books={books}
        isError={isError}
        isPending={isPending}
        onAddBook={() => router.push("/books/new")}
        onOpenLibrary={() => router.push("/books")}
        onRetry={() => void refetch()}
      />
    </div>
  );
}

function BooksToBuyContent({
  books,
  isError,
  isPending,
  onAddBook,
  onOpenLibrary,
  onRetry,
}: {
  books: BookView[];
  isError: boolean;
  isPending: boolean;
  onAddBook: () => void;
  onOpenLibrary: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("booksToBuy");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return <BooksToBuySkeleton />;
  }

  if (books.length === 0) {
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-purchases",
      primary: { icon: "plus", label: t("empty.cta") },
      secondary: { icon: "book", label: t("empty.secondary") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddBook} onSecondary={onOpenLibrary} state={emptyState} />;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {books.map((book) => (
        <li key={book.id}>
          <BooksToBuyRow book={book} />
        </li>
      ))}
    </ul>
  );
}

function BooksToBuyCover({ alt, src }: { alt: string; src?: string }) {
  if (src === undefined) {
    return (
      <div className="grid aspect-[3/4] w-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={18} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-md bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="44px" src={src} unoptimized />
    </div>
  );
}

function BooksToBuyRow({ book }: { book: BookView }) {
  const t = useTranslations("booksToBuy");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const authorNames = book.authors.map((author) => author.name).join(", ");

  return (
    <>
      <div className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
        <Link
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/books/${book.id}`}
        >
          <BooksToBuyCover alt={book.title} src={book.cover?.urls.thumb} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate font-heading text-sm leading-tight font-bold text-ink transition-colors group-hover:text-primary">
              {book.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{authorNames}</p>
          </div>
        </Link>
        {book.ownershipStatus === "want_to_buy" ? (
          <Button
            aria-label={t("markInTransitFor", { title: book.title })}
            className="shrink-0"
            onClick={() => setDeliveryOpen(true)}
            size="sm"
            variant="secondary"
          >
            <UiIcon name="truck" size={16} />
            <span className="hidden sm:inline">{t("markInTransit")}</span>
          </Button>
        ) : null}
      </div>
      <DeliveryDialog
        book={book}
        mode="create"
        onOpenChange={setDeliveryOpen}
        open={deliveryOpen}
      />
    </>
  );
}

function BooksToBuySkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2.5">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card"
          key={index}
        >
          <Skeleton className="aspect-[3/4] w-11 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
