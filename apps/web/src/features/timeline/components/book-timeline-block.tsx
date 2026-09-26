"use client";

import type {
  BookView,
  Nullable,
  TimelineEventType,
  TimelineEventView,
  TimelineImportance,
  TimelineReorderScope,
  TimelineView,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Button } from "@/components/ui/button";
import { assertNever } from "@/lib/assert-never";

import type { TimelineFilteredEmptyKind } from "../model/timeline-empty-state";
import type { TimelineEventsFilterState } from "../model/timeline-events-query";
import type { TimelineViewMode } from "../model/timeline-view-mode";

import { useBookTimelines } from "../api/use-book-timelines";
import { useTimelineEvents } from "../api/use-timeline-events";
import { useTimelineOverview } from "../api/use-timeline-overview";
import { useTimelineSummary } from "../api/use-timeline-summary";
import { resolveTimelineEmptyState } from "../model/timeline-empty-state";
import {
  createFilterState,
  hasActiveEventFilters,
  normalizeSortForMode,
} from "../model/timeline-events-query";
import {
  DEFAULT_TIMELINE_VIEW_MODE,
  readTimelineViewMode,
  writeTimelineViewMode,
} from "../model/timeline-view-mode";
import { useTimelineUrlState } from "../model/use-timeline-url-state";
import { DeleteEventDialog } from "./delete-event-dialog";
import { DeleteTimelineDialog } from "./delete-timeline-dialog";
import { EventActionsMenu } from "./event-actions-menu";
import { EventDetailDialog } from "./event-detail-dialog";
import { EventFormDialog } from "./event-form-dialog";
import { EventListView } from "./event-list-view";
import { EventStreamView } from "./event-stream-view";
import { ManageTimelinesDialog } from "./manage-timelines-dialog";
import { MoveEventDialog } from "./move-event-dialog";
import { ReadingPositionControls } from "./reading-position-controls";
import { TimelineActiveFilters } from "./timeline-active-filters";
import { TimelineEmpty } from "./timeline-empty";
import { TimelineError } from "./timeline-error";
import { TimelineFilteredEmpty } from "./timeline-filtered-empty";
import { TimelineFormDialog } from "./timeline-form-dialog";
import { TimelineLineEmpty } from "./timeline-line-empty";
import { TimelineOverviewView } from "./timeline-overview-view";
import { TimelineSkeleton } from "./timeline-skeleton";
import { TimelineSwitcher } from "./timeline-switcher";
import { TimelineToolbar } from "./timeline-toolbar";
import { TimelineViewSwitch } from "./timeline-view-switch";

type BookTimelineBlockProps = {
  book: BookView;
};

type EventDialogState =
  { event: TimelineEventView; mode: "edit" } | { mode: "closed" } | { mode: "create" };

type TimelineManagementState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "delete"; timeline: TimelineView }
  | { mode: "edit"; timeline: TimelineView }
  | { mode: "manage" };

export function BookTimelineBlock({ book }: BookTimelineBlockProps) {
  const t = useTranslations("timeline");
  const { setTimelineId, setView, timelineId, view } = useTimelineUrlState();

  const timelinesQuery = useBookTimelines(book.id);
  const summaryQuery = useTimelineSummary(book.id);
  const overviewQuery = useTimelineOverview(book.id);

  const timelines = useMemo(() => timelinesQuery.data?.timelines ?? [], [timelinesQuery.data]);
  const activeTimelineId =
    timelineId !== null && timelines.some((line) => line.id === timelineId) ? timelineId : null;
  const isAllLines = activeTimelineId === null;

  useEffect(() => {
    if (
      timelineId !== null &&
      timelines.length > 0 &&
      !timelines.some((line) => line.id === timelineId)
    ) {
      void setTimelineId(null);
    }
  }, [setTimelineId, timelineId, timelines]);

  const storedView = useSyncExternalStore(subscribeViewMode, readTimelineViewMode, () => null);
  const viewMode = view ?? storedView ?? DEFAULT_TIMELINE_VIEW_MODE;

  const [filters, setFilters] = useState<TimelineEventsFilterState>(() => createFilterState(null));
  const [openEventId, setOpenEventId] = useState<Nullable<string>>(null);
  const [guardOverride, setGuardOverride] = useState<Nullable<boolean>>(null);
  const [revealedEventIds, setRevealedEventIds] = useState<ReadonlySet<string>>(() => new Set());
  const [eventDialog, setEventDialog] = useState<EventDialogState>({ mode: "closed" });
  const [moveTarget, setMoveTarget] = useState<Nullable<TimelineEventView>>(null);
  const [deleteTarget, setDeleteTarget] = useState<Nullable<TimelineEventView>>(null);
  const [management, setManagement] = useState<TimelineManagementState>({ mode: "closed" });

  const eventFilters: TimelineEventsFilterState = { ...filters, timelineId: activeTimelineId };
  const eventsQuery = useTimelineEvents(book.id, eventFilters, {
    enabled: viewMode !== "overview",
  });

  const readingPosition = overviewQuery.data?.readingPosition ?? null;
  const currentPage =
    readingPosition !== null && readingPosition.positionKnown ? readingPosition.currentPage : null;
  const guardEnabled = guardOverride ?? readingPosition?.guardDefault ?? false;

  const totalEvents = summaryQuery.data?.totalEvents ?? 0;
  const selectedLineEventsCount =
    activeTimelineId === null
      ? null
      : (summaryQuery.data?.timelines.find((line) => line.timelineId === activeTimelineId)
          ?.eventsCount ?? 0);
  const events = eventsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const hasActiveFilters = hasActiveEventFilters(filters);
  const hasEventsError = eventsQuery.isError && !eventsQuery.isFetchNextPageError;
  const loadMoreState: InfiniteScrollState = eventsQuery.isFetchNextPageError
    ? "error"
    : eventsQuery.isFetchingNextPage
      ? "loading"
      : eventsQuery.hasNextPage
        ? "idle"
        : "none";

  const defaultLineId = timelines.find((line) => line.isDefault)?.id ?? timelines[0]?.id ?? null;
  const createTimelineId = activeTimelineId ?? defaultLineId;
  const canReorder =
    (filters.sort === "book_order" || filters.sort === "timeline_order") && !hasActiveFilters;
  const reorderScope: TimelineReorderScope =
    filters.sort === "timeline_order" ? "timeline" : "book";
  const eventIndexById = new Map(events.map((event, index) => [event.id, index] as const));
  const skeletonShape = viewMode === "list" ? "list" : "stream";

  function changeView(next: TimelineViewMode) {
    void setView(next);
    writeTimelineViewMode(next);
  }

  function selectTimeline(next: Nullable<string>) {
    void setTimelineId(next);
    setFilters((prev) => ({ ...prev, sort: normalizeSortForMode(prev.sort, next === null) }));
  }

  function resetFilters() {
    setFilters((prev) => ({
      ...createFilterState(prev.timelineId),
      sort: normalizeSortForMode(prev.sort, activeTimelineId === null),
    }));
  }

  function drillDownToType(eventType: TimelineEventType) {
    void setTimelineId(null);
    setFilters({ ...createFilterState(null), eventType: [eventType], sort: "book_order" });
    changeView("stream");
  }

  function drillDownToImportance(importance: TimelineImportance) {
    void setTimelineId(null);
    setFilters({ ...createFilterState(null), importance: [importance], sort: "book_order" });
    changeView("stream");
  }

  function drillDownToLine(nextTimelineId: string) {
    void setTimelineId(nextTimelineId);
    setFilters({ ...createFilterState(nextTimelineId), sort: "timeline_order" });
    changeView("stream");
  }

  function drillDownToWithoutChapter() {
    void setTimelineId(null);
    setFilters({ ...createFilterState(null), sort: "book_order", withoutChapter: true });
    changeView("stream");
  }

  function revealEvent(eventId: string) {
    setRevealedEventIds((current) => new Set(current).add(eventId));
  }

  function clearEmptyStateRestriction(kind: TimelineFilteredEmptyKind) {
    switch (kind) {
      case "filters":
        resetFilters();
        return;
      case "recap":
        setFilters((prev) => ({ ...prev, recap: false }));
        return;
      case "search":
        setFilters((prev) => ({ ...prev, search: "" }));
        return;
      case "withoutChapter":
        setFilters((prev) => ({ ...prev, withoutChapter: false }));
        return;
      default:
        assertNever(kind);
    }
  }

  function openCreateEvent() {
    setEventDialog({ mode: "create" });
  }

  function handleLineDeleted(deletedTimelineId: string) {
    if (activeTimelineId === deletedTimelineId) selectTimeline(null);
    setManagement({ mode: "manage" });
  }

  function renderActions(event: TimelineEventView) {
    const index = eventIndexById.get(event.id) ?? 0;
    return (
      <EventActionsMenu
        bookId={book.id}
        canReorder={canReorder}
        event={event}
        firstEventId={events[0]?.id ?? null}
        hasMorePages={eventsQuery.hasNextPage}
        isFirst={index === 0}
        isLast={index === events.length - 1}
        lastEventId={events[events.length - 1]?.id ?? null}
        neighborDownId={events[index + 1]?.id ?? null}
        neighborUpId={events[index - 1]?.id ?? null}
        onDelete={() => setDeleteTarget(event)}
        onEdit={() => setEventDialog({ event, mode: "edit" })}
        onMove={() => setMoveTarget(event)}
        onView={() => setOpenEventId(event.id)}
        reorderScope={reorderScope}
      />
    );
  }

  function renderEmptyState() {
    const emptyState = resolveTimelineEmptyState({
      activeTimelineId,
      filters: eventFilters,
      selectedLineEventsCount,
      totalEvents,
    });

    if (emptyState === "book") return <TimelineEmpty onAddEvent={openCreateEvent} />;
    if (emptyState === "line") {
      return (
        <TimelineLineEmpty
          onAddEvent={openCreateEvent}
          onPickAllLines={() => void setTimelineId(null)}
        />
      );
    }
    return (
      <TimelineFilteredEmpty
        onAction={() => clearEmptyStateRestriction(emptyState)}
        state={emptyState}
      />
    );
  }

  function renderViewContent() {
    if (viewMode === "overview") {
      if (overviewQuery.data === undefined) {
        return overviewQuery.isError ? (
          <TimelineError onRetry={() => void overviewQuery.refetch()} />
        ) : (
          <TimelineSkeleton shape="stream" />
        );
      }
      return (
        <TimelineOverviewView
          onSelectImportance={drillDownToImportance}
          onSelectLine={drillDownToLine}
          onSelectType={drillDownToType}
          onSelectWithoutChapter={drillDownToWithoutChapter}
          overview={overviewQuery.data}
          timelines={timelines}
        />
      );
    }

    if (eventsQuery.isPending) return <TimelineSkeleton shape={skeletonShape} />;
    if (hasEventsError) return <TimelineError onRetry={() => void eventsQuery.refetch()} />;

    if (events.length === 0) return renderEmptyState();

    return (
      <div className="flex flex-col gap-3">
        {viewMode === "list" ? (
          <EventListView
            currentPage={currentPage}
            events={events}
            guardEnabled={guardEnabled}
            isAllLines={isAllLines}
            onOpenEvent={setOpenEventId}
            onRevealEvent={revealEvent}
            renderActions={renderActions}
            revealedEventIds={revealedEventIds}
          />
        ) : (
          <EventStreamView
            currentPage={currentPage}
            events={events}
            guardEnabled={guardEnabled}
            hasNextPage={eventsQuery.hasNextPage}
            isAllLines={isAllLines}
            onOpenEvent={setOpenEventId}
            onRevealEvent={revealEvent}
            renderActions={renderActions}
            revealedEventIds={revealedEventIds}
            sort={filters.sort}
          />
        )}
        <InfiniteScrollFooter
          errorLabel={t("states.loadMoreError")}
          onLoadMore={() => void eventsQuery.fetchNextPage()}
          retryLabel={t("states.retry")}
          state={loadMoreState}
        />
      </div>
    );
  }

  function renderBody() {
    if (timelinesQuery.isError || summaryQuery.isError) {
      return (
        <TimelineError
          onRetry={() => {
            void timelinesQuery.refetch();
            void summaryQuery.refetch();
          }}
        />
      );
    }

    if (timelinesQuery.isPending || summaryQuery.isPending) {
      return <TimelineSkeleton shape={skeletonShape} />;
    }

    const showFilterControls = viewMode !== "overview";

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            {showFilterControls ? (
              <TimelineSwitcher
                activeTimelineId={activeTimelineId}
                onManageLines={() => setManagement({ mode: "manage" })}
                onSelect={selectTimeline}
                timelines={timelines}
                totalEvents={totalEvents}
              />
            ) : null}
            <TimelineViewSwitch
              className="shrink-0 self-start"
              onChange={changeView}
              value={viewMode}
            />
          </div>
          {showFilterControls ? (
            <>
              <TimelineToolbar
                filters={filters}
                isAllLines={isAllLines}
                onFiltersChange={setFilters}
              />
              <TimelineActiveFilters
                filters={filters}
                onChange={setFilters}
                onClearAll={resetFilters}
              />
              {readingPosition === null ? null : (
                <ReadingPositionControls
                  guardEnabled={guardEnabled}
                  onGuardChange={setGuardOverride}
                  onRecapChange={(recap) => setFilters((prev) => ({ ...prev, recap }))}
                  readingPosition={readingPosition}
                  recap={filters.recap}
                />
              )}
            </>
          ) : null}
        </div>
        {renderViewContent()}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-detail-block md:p-6">
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <UiIcon name="calendar" size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-base leading-tight font-semibold text-ink">
            {t("title")}
            {totalEvents > 0 ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {" · "}
                {totalEvents}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button className="ml-auto hidden md:inline-flex" onClick={openCreateEvent} size="sm">
          <UiIcon name="plus" size={16} />
          {t("addEvent")}
        </Button>
      </header>

      {renderBody()}

      <Button
        aria-label={t("addEvent")}
        className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-pop md:hidden"
        onClick={openCreateEvent}
      >
        <UiIcon className="size-6" name="plus" />
      </Button>

      <EventDetailDialog
        currentPage={currentPage}
        eventId={openEventId}
        guardEnabled={guardEnabled}
        onDelete={(event) => {
          setOpenEventId(null);
          setDeleteTarget(event);
        }}
        onEdit={(event) => {
          setOpenEventId(null);
          setEventDialog({ event, mode: "edit" });
        }}
        onOpenChange={(open) => {
          if (!open) setOpenEventId(null);
        }}
        onRevealEvent={revealEvent}
        revealedEventIds={revealedEventIds}
      />

      <EventFormDialog
        bookId={book.id}
        createTimelineId={createTimelineId}
        event={eventDialog.mode === "edit" ? eventDialog.event : undefined}
        onOpenChange={(open) => {
          if (!open) setEventDialog({ mode: "closed" });
        }}
        open={eventDialog.mode !== "closed"}
        pagesCount={book.pagesCount}
        readingPosition={readingPosition}
        timelines={timelines}
      />

      <MoveEventDialog
        bookId={book.id}
        event={moveTarget}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
        timelines={timelines}
      />

      <DeleteEventDialog
        bookId={book.id}
        event={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />

      {management.mode === "manage" ? (
        <ManageTimelinesDialog
          bookId={book.id}
          onClose={() => setManagement({ mode: "closed" })}
          onCreate={() => setManagement({ mode: "create" })}
          onDelete={(timeline) => setManagement({ mode: "delete", timeline })}
          onEdit={(timeline) => setManagement({ mode: "edit", timeline })}
        />
      ) : null}

      {management.mode === "create" || management.mode === "edit" ? (
        <TimelineFormDialog
          bookId={book.id}
          onClose={() => setManagement({ mode: "manage" })}
          timeline={management.mode === "edit" ? management.timeline : undefined}
          timelines={timelines}
        />
      ) : null}

      {management.mode === "delete" ? (
        <DeleteTimelineDialog
          bookId={book.id}
          onClose={() => setManagement({ mode: "manage" })}
          onDeleted={handleLineDeleted}
          timeline={management.timeline}
          timelines={timelines}
        />
      ) : null}
    </section>
  );
}

function subscribeViewMode(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
