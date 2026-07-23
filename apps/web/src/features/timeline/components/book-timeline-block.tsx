"use client";

import type {
  BookView,
  Nullable,
  TimelineEventType,
  TimelineEventView,
  TimelineReorderScope,
  TimelineView,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";
import type { TimelineViewMode } from "../model/timeline-view-mode";

import { useBookTimelines } from "../api/use-book-timelines";
import { useTimelineEvents } from "../api/use-timeline-events";
import { useTimelineOverview } from "../api/use-timeline-overview";
import { useTimelineSummary } from "../api/use-timeline-summary";
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
import { TimelineEmpty } from "./timeline-empty";
import { TimelineError } from "./timeline-error";
import { TimelineFilteredEmpty } from "./timeline-filtered-empty";
import { TimelineFormDialog } from "./timeline-form-dialog";
import { TimelineLineEmpty } from "./timeline-line-empty";
import { TimelineOverviewView } from "./timeline-overview-view";
import { TimelineSkeleton } from "./timeline-skeleton";
import { TimelineSwitcher } from "./timeline-switcher";
import { TimelineToolbar } from "./timeline-toolbar";

type BookTimelineBlockProps = {
  book: BookView;
};

type EventDialogState =
  { event: TimelineEventView; mode: "edit" } | { mode: "closed" } | { mode: "create" };

type LineFormState =
  { mode: "closed" } | { mode: "create" } | { mode: "edit"; timeline: TimelineView };

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
  const [eventDialog, setEventDialog] = useState<EventDialogState>({ mode: "closed" });
  const [moveTarget, setMoveTarget] = useState<Nullable<TimelineEventView>>(null);
  const [deleteTarget, setDeleteTarget] = useState<Nullable<TimelineEventView>>(null);
  const [manageLinesOpen, setManageLinesOpen] = useState(false);
  const [lineForm, setLineForm] = useState<LineFormState>({ mode: "closed" });
  const [deleteLineTarget, setDeleteLineTarget] = useState<Nullable<TimelineView>>(null);

  const eventFilters: TimelineEventsFilterState = { ...filters, timelineId: activeTimelineId };
  const eventsQuery = useTimelineEvents(book.id, eventFilters);

  const readingPosition = overviewQuery.data?.readingPosition ?? null;
  const currentPage =
    readingPosition !== null && readingPosition.positionKnown ? readingPosition.currentPage : null;
  const guardEnabled = guardOverride ?? readingPosition?.guardDefault ?? false;

  const totalEvents = summaryQuery.data?.totalEvents ?? 0;
  const events = eventsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const hasActiveFilters = hasActiveEventFilters(filters);

  const defaultLineId = timelines.find((line) => line.isDefault)?.id ?? timelines[0]?.id ?? null;
  const createTimelineId = activeTimelineId ?? defaultLineId;
  const canReorder =
    (filters.sort === "book_order" || filters.sort === "timeline_order") && !hasActiveFilters;
  const reorderScope: TimelineReorderScope =
    filters.sort === "timeline_order" ? "timeline" : "book";
  const eventIndexById = new Map(events.map((event, index) => [event.id, index] as const));

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

  function selectType(type: TimelineEventType) {
    setFilters((prev) => ({ ...prev, eventType: [type] }));
    changeView("stream");
  }

  function selectLine(nextTimelineId: string) {
    selectTimeline(nextTimelineId);
    changeView("stream");
  }

  function openCreateEvent() {
    setEventDialog({ mode: "create" });
  }

  function openCreateLine() {
    setLineForm({ mode: "create" });
  }

  function openEditLine(timeline: TimelineView) {
    setLineForm({ mode: "edit", timeline });
  }

  function handleLineDeleted(deletedTimelineId: string) {
    if (activeTimelineId === deletedTimelineId) selectTimeline(null);
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

  function renderViewContent() {
    if (viewMode === "overview") {
      if (overviewQuery.data === undefined) {
        return overviewQuery.isError ? (
          <TimelineError onRetry={() => void overviewQuery.refetch()} />
        ) : (
          <TimelineSkeleton />
        );
      }
      return (
        <TimelineOverviewView
          onSelectLine={selectLine}
          onSelectType={selectType}
          overview={overviewQuery.data}
        />
      );
    }

    if (eventsQuery.isPending) return <TimelineSkeleton />;
    if (eventsQuery.isError) return <TimelineError onRetry={() => void eventsQuery.refetch()} />;

    if (events.length === 0) {
      if (hasActiveFilters) return <TimelineFilteredEmpty onReset={resetFilters} />;
      if (activeTimelineId !== null) {
        return (
          <TimelineLineEmpty
            onAddEvent={openCreateEvent}
            onPickAllLines={() => void setTimelineId(null)}
          />
        );
      }
      return <TimelineEmpty onAddEvent={openCreateEvent} />;
    }

    return (
      <div className="flex flex-col gap-3">
        {viewMode === "list" ? (
          <EventListView
            events={events}
            onOpenEvent={setOpenEventId}
            renderActions={renderActions}
            showTimelineName={isAllLines}
          />
        ) : (
          <EventStreamView
            currentPage={currentPage}
            events={events}
            guardEnabled={guardEnabled}
            onOpenEvent={setOpenEventId}
            renderActions={renderActions}
            showTimelineName={isAllLines}
            sort={filters.sort}
          />
        )}
        {eventsQuery.hasNextPage ? (
          <Button
            className="self-center"
            loading={eventsQuery.isFetchingNextPage}
            onClick={() => void eventsQuery.fetchNextPage()}
            size="sm"
            variant="ghost"
          >
            {t("states.loadMore")}
          </Button>
        ) : null}
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

    if (timelinesQuery.isPending || summaryQuery.isPending) return <TimelineSkeleton />;

    const showFilterControls = viewMode !== "overview";

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <TimelineSwitcher
            activeTimelineId={activeTimelineId}
            onCreateLine={openCreateLine}
            onEditLine={openEditLine}
            onManageLines={() => setManageLinesOpen(true)}
            onSelect={selectTimeline}
            timelines={timelines}
            totalEvents={totalEvents}
          />
          <TimelineToolbar
            filters={filters}
            hasActiveFilters={hasActiveFilters}
            isAllLines={isAllLines}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            onViewChange={changeView}
            showFilterControls={showFilterControls}
            view={viewMode}
          />
          {showFilterControls && readingPosition !== null ? (
            <ReadingPositionControls
              guardEnabled={guardEnabled}
              onGuardChange={setGuardOverride}
              onRecapChange={(recap) => setFilters((prev) => ({ ...prev, recap }))}
              readingPosition={readingPosition}
              recap={filters.recap}
            />
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
        eventId={openEventId}
        onDelete={(event) => {
          setOpenEventId(null);
          setDeleteTarget(event);
        }}
        onEdit={(event) => {
          setOpenEventId(null);
          setEventDialog({ event, mode: "edit" });
        }}
        onNavigate={setOpenEventId}
        onOpenChange={(open) => {
          if (!open) setOpenEventId(null);
        }}
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

      <ManageTimelinesDialog
        bookId={book.id}
        onCreate={openCreateLine}
        onDelete={setDeleteLineTarget}
        onEdit={openEditLine}
        onOpenChange={setManageLinesOpen}
        open={manageLinesOpen}
        timelines={timelines}
      />

      <TimelineFormDialog
        bookId={book.id}
        onOpenChange={(open) => {
          if (!open) setLineForm({ mode: "closed" });
        }}
        open={lineForm.mode !== "closed"}
        timeline={lineForm.mode === "edit" ? lineForm.timeline : undefined}
      />

      <DeleteTimelineDialog
        bookId={book.id}
        onDeleted={handleLineDeleted}
        onOpenChange={(open) => {
          if (!open) setDeleteLineTarget(null);
        }}
        timeline={deleteLineTarget}
        timelines={timelines}
      />
    </section>
  );
}

function subscribeViewMode(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
