"use client";

import type { ReadingQueueItemView } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { RefreshingRegion } from "@/components/refreshing-region";
import { SummaryError } from "@/components/summary-error";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenres } from "@/features/genres";
import { useCreateButtonFocus } from "@/hooks/use-create-button-focus";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { useRouter } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { collectionChrome } from "@/lib/collection-chrome";
import { withPresenceRetry } from "@/lib/collection-presence";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

import type { LibraryPresence } from "../api/use-library-presence";
import type { LibraryBookLabels } from "../model/library-book";

import { useLibraryPresence } from "../api/use-library-presence";
import {
  useReadingQueue,
  useReadingQueueSummary,
  useReorderReadingQueue,
} from "../api/use-reading-queue";
import { useSeriesOrderIssues } from "../api/use-series-order-check";
import { useSelectedTags } from "../api/use-tags-search";
import { useQueueSummaryCards } from "../hooks/use-queue-summary-cards";
import { BOOK_CREATE_PATH } from "../model/book-create-href";
import { toQueuePickerItems } from "../model/queue-placement";
import {
  type QueueFilterState,
  toQueueFilterPatch,
  toQueueFilterState,
} from "../model/reading-queue-filters";
import { SERIES_ORDER_SIDEBAR_LIMIT } from "../model/series-order-check";
import { useReadingQueueQuery } from "../model/use-reading-queue-query";
import { useRemoveFromQueueWithUndo } from "../model/use-remove-from-queue-with-undo";
import { AddBookToQueueDialog } from "./add-book-to-queue-dialog";
import { QueueSummaryCards, QueueSummaryCardsSkeleton } from "./queue-summary-cards";
import { QueueVolumeBlock, QueueVolumeSkeleton } from "./queue-volume-block";
import { ReadingQueueFilters } from "./reading-queue-filters";
import { ReadingQueueList } from "./reading-queue-list";
import { ReadingQueueOverviewPanel } from "./reading-queue-overview-panel";
import { ReadingQueueToolbar } from "./reading-queue-toolbar";
import { SeriesOrderCheckBlock } from "./series-order-check-block";
import { SeriesOrderCheckSkeleton } from "./series-order-check-skeleton";
import { StartReadingDialog } from "./start-reading-dialog";

const SKELETON_COUNT = 6;

const QUEUE_EMPTY_HREF = {
  addFirstBook: BOOK_CREATE_PATH,
  openLibrary: "/books",
} as const;

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

  const queue = useReadingQueueQuery();
  const {
    data,
    isLoadingError,
    isPending,
    isPlaceholderData,
    isRefetchError,
    isRefetching,
    refetch,
  } = useReadingQueue(queue.listParams);
  const summary = useReadingQueueSummary();
  const presence = useLibraryPresence();
  const seriesOrderIssues = useSeriesOrderIssues({ limit: SERIES_ORDER_SIDEBAR_LIMIT });
  const genres = useGenres();
  const selectedTags = useSelectedTags(queue.state.tag);
  const removeFromQueue = useRemoveFromQueueWithUndo();
  const reorder = useReorderReadingQueue(queue.listParams);

  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [startTarget, setStartTarget] = useState<null | StartTarget>(null);

  const serverItems = data?.items ?? [];
  const unfilteredQueueTotal = data?.totalCount;
  const isQueueEmpty = unfilteredQueueTotal === 0;
  const showHeaderAddBook = !isQueueEmpty || presence.kind !== "ready";
  const queueChrome = collectionChrome({
    baseTotal: unfilteredQueueTotal,
    hasQuery: queue.isFiltered,
  });

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

  function rememberEntity(id: string, name: string) {
    setEntityLabels((prev) => (prev[id] === name ? prev : { ...prev, [id]: name }));
  }

  function resolveEntityName(id: string): string | undefined {
    return entityLabels[id] ?? selectedTags.get(id)?.name;
  }

  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultsRegionRef = useRef<HTMLElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(resultsRegionRef);
  const { createButtonRef, focusCreateButtonOnClose } = useCreateButtonFocus();
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

  const seriesWithIssuesCount = seriesOrderIssues.data?.seriesInQueueWithIssuesCount ?? 0;
  const summaryCards = useQueueSummaryCards({
    seriesWithIssuesCount,
    summary: summary.data ?? null,
  });

  const filterCount = queue.activeFilterCount;
  const displayItems = localItems;
  const isFiltered = queue.isFiltered;
  const draggable = !isFiltered && !reorder.isPending && !isPlaceholderData;
  const canMove = !isFiltered && !reorder.isPending && !isPlaceholderData;
  const filters: QueueFilterState = toQueueFilterState(queue.state);

  function clearQueueFilters() {
    queue.clearAll();
  }

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

  const dragHint = isQueueEmpty ? "hidden" : isFiltered ? "filtered" : "available";
  const toolbar = (
    <ReadingQueueToolbar
      dragHint={dragHint}
      filters={
        <ReadingQueueFilters
          activeCount={filterCount}
          onApply={(next) => void queue.setState(toQueueFilterPatch(next))}
          onRememberEntity={rememberEntity}
          resolveEntityName={resolveEntityName}
          state={filters}
        />
      }
      onClearSearch={queue.clearSearch}
      onSearchChange={queue.setSearch}
      search={queue.state.q}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {showHeaderAddBook ? (
          <Button
            className="self-start sm:self-auto"
            onClick={() => setAddOpen(true)}
            ref={createButtonRef}
          >
            <UiIcon name="plus" size={16} />
            {t("addBook")}
          </Button>
        ) : null}
      </header>

      <RefetchErrorBanner
        state={isRefetchError ? { isRetrying: isRefetching, onRetry: () => void refetch() } : null}
      />

      <section
        aria-label={t("title")}
        className={cn("flex flex-col gap-6", RETRY_FOCUS_RING.onTarget)}
        ref={resultsRegionRef}
        tabIndex={-1}
      >
        {isLoadingError ? (
          <div aria-live="assertive" role="alert">
            <EmptyState
              onPrimary={withRetryFocus(() => void refetch())}
              primaryRef={retryButtonRef}
              state={errorState}
            />
          </div>
        ) : isPending ? (
          <QueueSkeleton />
        ) : isQueueEmpty ? (
          <>
            {queueChrome.showTools ? toolbar : null}
            <QueueEmptyCollection
              onOpenPicker={() => setAddOpen(true)}
              openPickerButtonRef={createButtonRef}
              presence={withPresenceRetry({ presence, wrapRetry: withRetryFocus })}
              retryButtonRef={retryButtonRef}
            />
          </>
        ) : (
          <>
            <SummaryError
              state={summary.isLoadingError ? { onRetry: () => void summary.refetch() } : null}
            >
              <QueueSummaryCards
                isLoading={summary.isPending}
                mobileAction={
                  <ReadingQueueOverviewPanel
                    isLoading={summary.isPending}
                    items={serverItems}
                    seriesWithIssuesCount={seriesWithIssuesCount}
                    summaryCards={summaryCards}
                  />
                }
                seriesWithIssuesCount={seriesWithIssuesCount}
                summary={summary.data ?? null}
              />
            </SummaryError>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div className="flex min-w-0 flex-col gap-4">
                <h2 className="sr-only" ref={listHeadingRef} tabIndex={-1}>
                  {t("listHeading")}
                </h2>
                <QueueVolumeBlock className="max-sm:hidden lg:hidden" items={serverItems} />
                {toolbar}
                {isFiltered && displayItems.length === 0 ? (
                  <RefreshingRegion isRefreshing={isPlaceholderData}>
                    <EmptyState onPrimary={clearQueueFilters} state={noResultsState} />
                  </RefreshingRegion>
                ) : (
                  <RefreshingRegion isRefreshing={isPlaceholderData}>
                    <ReadingQueueList
                      canMove={canMove}
                      draggable={draggable}
                      filtered={isFiltered}
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
                  </RefreshingRegion>
                )}
              </div>

              <aside className="hidden flex-col gap-4 lg:flex">
                <QueueVolumeBlock items={serverItems} />
                <SeriesOrderCheckBlock />
              </aside>
            </div>
          </>
        )}
      </section>

      <AddBookToQueueDialog
        onCloseAutoFocus={focusCreateButtonOnClose}
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

function QueueEmptyCollection({
  onOpenPicker,
  openPickerButtonRef,
  presence,
  retryButtonRef,
}: {
  onOpenPicker: () => void;
  openPickerButtonRef: Ref<HTMLButtonElement>;
  presence: LibraryPresence;
  retryButtonRef: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("readingQueue");
  const tBooks = useTranslations("books");
  const router = useRouter();

  switch (presence.kind) {
    case "error": {
      const errorState: EmptyStateEntry = {
        desc: t("error.description"),
        illu: "error-generic",
        primary: { icon: "refresh", label: t("error.retry") },
        title: t("error.title"),
      };
      return (
        <div aria-live="assertive" role="alert">
          <EmptyState onPrimary={presence.retry} primaryRef={retryButtonRef} state={errorState} />
        </div>
      );
    }
    case "pending":
      return <QueueSkeleton />;
    case "ready": {
      if (presence.total === 0) {
        const noBooksState: EmptyStateEntry = {
          desc: t("empty.noBooks.description"),
          illu: "empty-queue",
          primary: { icon: "plus", label: tBooks("firstBook.cta") },
          title: t("empty.noBooks.title"),
        };
        return (
          <EmptyState
            onPrimary={() => router.push(QUEUE_EMPTY_HREF.addFirstBook)}
            state={noBooksState}
          />
        );
      }
      const emptyQueueState: EmptyStateEntry = {
        desc: t("empty.description"),
        illu: "empty-queue",
        primary: { icon: "plus", label: t("empty.cta") },
        secondary: { icon: "book", label: t("empty.secondary") },
        title: t("empty.title"),
      };
      return (
        <EmptyState
          onPrimary={onOpenPicker}
          onSecondary={() => router.push(QUEUE_EMPTY_HREF.openLibrary)}
          primaryRef={openPickerButtonRef}
          state={emptyQueueState}
        />
      );
    }
    default:
      return assertNever(presence);
  }
}

function QueueSkeleton() {
  const t = useTranslations("books.library");
  return (
    <>
      <QueueSummaryCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div
          aria-busy
          aria-label={t("loading")}
          className="flex min-w-0 flex-col gap-4"
          role="status"
        >
          <QueueVolumeSkeleton className="max-sm:hidden lg:hidden" />
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <Skeleton className="h-[9.5rem] w-full rounded-xl" key={index} />
            ))}
          </div>
        </div>
        <div className="hidden flex-col gap-4 lg:flex">
          <QueueVolumeSkeleton />
          <SeriesOrderCheckSkeleton />
        </div>
      </div>
    </>
  );
}
