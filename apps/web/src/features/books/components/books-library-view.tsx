"use client";

import type { MediaView } from "@app/shared";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import type { GenreIconName } from "@/components/icons";
import type { StatusEntry } from "@/lib/book-status";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { BooksSortDirection } from "../api/use-books";

import { BookCardMenu } from "./book-card-menu";
import { DeleteBookDialog } from "./delete-book-dialog";
import { LibraryCoverViewer } from "./library-cover-viewer";

export type LibraryBook = {
  author: string;
  cover?: { alt?: string; src: string };
  coverMedia?: MediaView;
  genres?: { icon?: GenreIconName; label: string }[];
  href: string;
  id: string;
  progress?: { ariaLabel: string; current: number; total: number; unit: string };
  rating?: number;
  ratingLabel?: string;
  selected?: boolean;
  series?: string;
  status: StatusEntry;
  title: string;
};

type BookLinkComponent = React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  href: string;
}>;

type BooksLibraryViewProps = {
  addBookLabel: string;
  books: LibraryBook[];
  count: string;
  coverViewLabel: string;
  deleteLabels: DeleteLabels;
  emptyState: EmptyStateEntry;
  errorState: EmptyStateEntry;
  hasNextPage: boolean;
  isDeleting: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  linkComponent?: BookLinkComponent;
  loadingLabel: string;
  loadMoreLabel: string;
  menuLabels: MenuLabels;
  onAddBook: () => void;
  onDeleteBook: (id: string, onSettled: () => void) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onSortChange: (value: BooksSortDirection) => void;
  sortDirection: BooksSortDirection;
  sortLabels: SortLabels;
  title: string;
};

type DeleteLabels = {
  cancel: string;
  confirm: string;
  deleting: string;
  description: (title: string) => string;
  title: string;
};

type MenuLabels = {
  delete: string;
  menu: string;
};

type PendingDeleteBook = {
  id: string;
  title: string;
};

type SortLabels = {
  label: string;
  newest: string;
  oldest: string;
};

const SKELETON_COUNT = 8;
const STAGGER_STEP_MS = 45;
const STAGGER_MAX_MS = 360;

export function BooksLibraryView({
  addBookLabel,
  books,
  count,
  coverViewLabel,
  deleteLabels,
  emptyState,
  errorState,
  hasNextPage,
  isDeleting,
  isError,
  isFetchingNextPage,
  isPending,
  linkComponent,
  loadingLabel,
  loadMoreLabel,
  menuLabels,
  onAddBook,
  onDeleteBook,
  onLoadMore,
  onRetry,
  onSortChange,
  sortDirection,
  sortLabels,
  title,
}: BooksLibraryViewProps) {
  const [pendingDeleteBook, setPendingDeleteBook] = useState<null | PendingDeleteBook>(null);
  const [activeCover, setActiveCover] = useState<null | {
    bookId: string;
    media: MediaView;
    title: string;
  }>(null);
  const prefersReducedMotion = useReducedMotion();

  if (isError) {
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} onSecondary={onAddBook} state={errorState} />
      </div>
    );
  }

  if (!isPending && books.length === 0) {
    return <EmptyState onPrimary={onAddBook} state={emptyState} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
            {title}
          </h1>
          {isPending ? null : <p className="text-sm text-muted-foreground">{count}</p>}
          <div aria-live="polite" className="sr-only">
            {isPending ? loadingLabel : count}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select
            onValueChange={(value) => onSortChange(value === "asc" ? "asc" : "desc")}
            value={sortDirection}
          >
            <SelectTrigger aria-label={sortLabels.label} className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">{sortLabels.newest}</SelectItem>
              <SelectItem value="asc">{sortLabels.oldest}</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={onAddBook}>
            <UiIcon name="plus" size={16} />
            {addBookLabel}
          </Button>
        </div>
      </header>

      {isPending ? (
        <BooksGrid aria-busy>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div
              className="grid motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in"
              key={index}
              style={{ animationDelay: staggerDelay(index) }}
            >
              <BookCardSkeleton />
            </div>
          ))}
        </BooksGrid>
      ) : (
        <>
          <BooksGrid>
            {books.map((book, index) => {
              const coverMedia = book.coverMedia;
              return (
                <div
                  className="grid motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                  key={book.id}
                  style={{ animationDelay: staggerDelay(index) }}
                >
                  <motion.div
                    className="grid h-full"
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                  >
                    <BookCard
                      author={book.author}
                      cover={book.cover}
                      coverActivateLabel={coverViewLabel}
                      genres={book.genres}
                      href={book.href}
                      kebab={
                        <BookCardMenu
                          deleteLabel={menuLabels.delete}
                          menuLabel={menuLabels.menu}
                          onDelete={() => setPendingDeleteBook({ id: book.id, title: book.title })}
                        />
                      }
                      linkComponent={linkComponent}
                      onCoverActivate={
                        coverMedia
                          ? () =>
                              setActiveCover({
                                bookId: book.id,
                                media: coverMedia,
                                title: book.title,
                              })
                          : undefined
                      }
                      progress={book.progress}
                      rating={book.rating}
                      ratingLabel={book.ratingLabel}
                      selected={book.selected}
                      series={book.series}
                      status={book.status}
                      title={book.title}
                    />
                  </motion.div>
                </div>
              );
            })}
          </BooksGrid>

          {hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                disabled={isFetchingNextPage}
                loading={isFetchingNextPage}
                onClick={onLoadMore}
                variant="secondary"
              >
                {loadMoreLabel}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {activeCover && (
        <LibraryCoverViewer
          bookId={activeCover.bookId}
          key={activeCover.bookId}
          media={activeCover.media}
          onClose={() => setActiveCover(null)}
          title={activeCover.title}
        />
      )}

      <DeleteBookDialog
        cancelLabel={deleteLabels.cancel}
        confirmLabel={deleteLabels.confirm}
        deletingLabel={deleteLabels.deleting}
        description={deleteLabels.description(pendingDeleteBook?.title ?? "")}
        isDeleting={isDeleting}
        onConfirm={() => {
          if (pendingDeleteBook === null) return;
          onDeleteBook(pendingDeleteBook.id, () => setPendingDeleteBook(null));
        }}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDeleteBook(null);
        }}
        open={pendingDeleteBook !== null}
        title={deleteLabels.title}
      />
    </div>
  );
}

function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex gap-3.5">
        <Skeleton className="h-[108px] w-[74px] shrink-0 rounded-md" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-1 h-5 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

function BooksGrid({
  children,
  ...props
}: React.ComponentProps<"div"> & { children: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]"
      {...props}
    >
      {children}
    </div>
  );
}

function staggerDelay(index: number): string {
  return `${Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms`;
}
