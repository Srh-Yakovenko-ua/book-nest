"use client";

import type { ReadingQueueItemView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";

import type { LibraryBookLabels } from "../model/library-book";

import { useGenres } from "../api/use-genres";
import { useReadingQueue, useReorderReadingQueue } from "../api/use-reading-queue";
import { toQueuePickerItems } from "../model/queue-placement";
import { useRemoveFromQueueWithUndo } from "../model/use-remove-from-queue-with-undo";
import { AddBookToQueueDialog } from "./add-book-to-queue-dialog";
import { NextToReadCard } from "./next-to-read-card";
import { QueueStats } from "./queue-stats";
import { ReadingQueueList } from "./reading-queue-list";
import { ReadingQueueToolbar } from "./reading-queue-toolbar";
import { StartReadingDialog } from "./start-reading-dialog";

const SKELETON_COUNT = 6;

type StartTarget = {
  id: string;
  title: string;
};

export function ReadingQueueView() {
  const t = useTranslations("readingQueue");
  const tLibrary = useTranslations("books.library");
  const tFormat = useTranslations("books.format.options");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tAgeCategory = useTranslations("books.classification.ageCategoryLabels");
  const router = useRouter();

  const { data, isError, isPending, refetch } = useReadingQueue();
  const genres = useGenres();
  const removeFromQueue = useRemoveFromQueueWithUndo();
  const reorder = useReorderReadingQueue();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [startTarget, setStartTarget] = useState<null | StartTarget>(null);

  const serverItems = data?.items ?? [];
  const count = data?.count ?? 0;
  const totalPagesCount = data?.totalPagesCount ?? 0;

  const serverOrderKey = serverItems.map((item) => item.book.id).join("\n");
  const [localOrder, setLocalOrder] = useState<string[]>(() =>
    serverItems.map((item) => item.book.id),
  );
  const [syncedKey, setSyncedKey] = useState(serverOrderKey);
  if (serverOrderKey !== syncedKey) {
    setSyncedKey(serverOrderKey);
    setLocalOrder(serverItems.map((item) => item.book.id));
  }

  const serverItemById = new Map(serverItems.map((item) => [item.book.id, item]));
  const localItems = localOrder
    .map((id) => serverItemById.get(id))
    .filter((item): item is ReadingQueueItemView => item !== undefined);

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousServerOrderKey = useRef(serverOrderKey);
  useEffect(() => {
    const previousKey = previousServerOrderKey.current;
    previousServerOrderKey.current = serverOrderKey;
    const previousIds = previousKey === "" ? [] : previousKey.split("\n");
    const currentIds = serverOrderKey === "" ? [] : serverOrderKey.split("\n");
    const removedVisibleBook = previousIds.some((id) => !currentIds.includes(id));
    const focusLeftToBody =
      document.activeElement === null || document.activeElement === document.body;
    if (!removedVisibleBook || !focusLeftToBody) return;
    listHeadingRef.current?.focus({ preventScroll: true });
  }, [serverOrderKey]);

  const labels: LibraryBookLabels = {
    ageBadge18Plus: tAgeCategory("18_plus"),
    borrowedFrom: (name) => tLibrary("card.borrowedFrom", { name }),
    formatLabel: (value) => tFormat(value),
    genreName: (key) => genreNameByKey.get(key) ?? key,
    lentTo: (name) => tLibrary("card.lentTo", { name }),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value) => tLibrary("meta.pages", { value }),
    progressAriaLabel: (current, total) => tLibrary("progress.ariaLabel", { current, total }),
    progressUnit: tLibrary("progress.unit"),
    ratingLabel: (value) => tLibrary("rating.ariaLabel", { value }),
    seriesPosition: (position, total) => tLibrary("card.seriesPosition", { position, total }),
    statusLabel: (value) => tStatus(value),
  };

  const normalizedQuery = search.trim().toLowerCase();
  const hasSearch = normalizedQuery !== "";
  const displayItems = hasSearch
    ? localItems.filter((item) => matchesQueueSearch(item, normalizedQuery))
    : localItems;
  const draggable = !hasSearch && !reorder.isPending;

  function commitOrder(items: ReadingQueueItemView[]) {
    reorder.mutate(
      items.map((item) => item.book.id),
      { onError: () => toast.error(t("reorder.error")) },
    );
  }

  function handleMove(items: ReadingQueueItemView[]) {
    setLocalOrder(items.map((item) => item.book.id));
    commitOrder(items);
  }

  const emptyState: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-queue",
    primary: { icon: "plus", label: t("empty.cta") },
    secondary: { icon: "book", label: t("empty.secondary") },
    title: t("empty.title"),
  };

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  const noResultsState: EmptyStateEntry = {
    desc: t("noSearchResults.description"),
    illu: "empty-search",
    primary: { icon: "x", label: t("noSearchResults.clear") },
    title: t("noSearchResults.title"),
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            {isPending ? (
              <Skeleton className="h-6 w-16 rounded-full" />
            ) : isError ? null : (
              <Badge variant="secondary">{t("countBadge", { count })}</Badge>
            )}
            <TitleLeaf />
          </div>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setAddOpen(true)}>
          <UiIcon name="plus" size={16} />
          {t("addBook")}
        </Button>
      </header>

      {isError ? (
        <div aria-live="assertive" role="alert">
          <EmptyState onPrimary={() => void refetch()} state={errorState} />
        </div>
      ) : isPending ? (
        <QueueSkeleton />
      ) : count === 0 ? (
        <EmptyState
          onPrimary={() => setAddOpen(true)}
          onSecondary={() => router.push("/books")}
          state={emptyState}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <h2 className="sr-only" ref={listHeadingRef} tabIndex={-1}>
              {t("listHeading")}
            </h2>
            <ReadingQueueToolbar
              hasSearch={hasSearch}
              onClearSearch={() => setSearch("")}
              onSearchChange={setSearch}
              search={search}
            />
            {hasSearch && displayItems.length === 0 ? (
              <EmptyState onPrimary={() => setSearch("")} state={noResultsState} />
            ) : (
              <ReadingQueueList
                canMove={!hasSearch}
                draggable={draggable}
                hasSearch={hasSearch}
                items={displayItems}
                labels={labels}
                onDragCommit={() => commitOrder(localItems)}
                onMove={handleMove}
                onRemove={(item) => removeFromQueue.remove(item.book.id, item.position)}
                onReorderLocal={(items) => setLocalOrder(items.map((item) => item.book.id))}
                onStartReading={(item) =>
                  setStartTarget({ id: item.book.id, title: item.book.title })
                }
              />
            )}
          </div>

          <aside className="hidden flex-col gap-4 lg:flex">
            <NextToReadCard
              item={serverItems[0] ?? null}
              labels={labels}
              onStartReading={() => {
                const next = serverItems[0];
                if (next !== undefined) {
                  setStartTarget({ id: next.book.id, title: next.book.title });
                }
              }}
            />
            <QueueStats count={count} totalPagesCount={totalPagesCount} />
          </aside>
        </div>
      )}

      <AddBookToQueueDialog
        onOpenChange={setAddOpen}
        open={addOpen}
        queueItems={toQueuePickerItems(serverItems)}
      />
      <StartReadingDialog
        book={startTarget}
        onOpenChange={(open) => {
          if (!open) setStartTarget(null);
        }}
      />
    </div>
  );
}

function matchesQueueSearch(item: ReadingQueueItemView, query: string): boolean {
  const { book } = item;
  const haystack = [
    book.title,
    book.originalTitle ?? "",
    book.series?.name ?? "",
    ...book.authors.map((author) => author.name),
    ...book.genres,
    ...book.tags.map((tag) => tag.name),
  ];
  return haystack.some((part) => part.toLowerCase().includes(query));
}

function QueueSkeleton() {
  const t = useTranslations("books.library");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div
        aria-busy
        aria-label={t("loading")}
        className="flex min-w-0 flex-col gap-4"
        role="status"
      >
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <Skeleton className="h-[5.25rem] w-full rounded-xl" key={index} />
          ))}
        </div>
      </div>
      <div className="hidden flex-col gap-4 lg:flex">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
