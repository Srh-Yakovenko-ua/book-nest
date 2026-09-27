"use client";

import type { Nullable, TimelineColorKey, TimelineEventSort, TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { EventCardContextMode } from "./event-card";

import { groupEventsByChapter } from "../model/chapter-grouping";
import { markerStyle } from "../model/color-key";
import { eventGuardReason, GUARD_REASON_LABEL_KEYS } from "../model/event-guard";
import { readingMarkerIndex } from "../model/reading-position";
import { EventCard } from "./event-card";
import { PositionMarker } from "./position-marker";

type EventStreamViewProps = {
  currentPage: Nullable<number>;
  events: TimelineEventView[];
  guardEnabled: boolean;
  hasNextPage: boolean;
  isAllLines: boolean;
  onOpenEvent: (eventId: string) => void;
  onRevealEvent: (eventId: string) => void;
  renderActions?: (event: TimelineEventView) => ReactNode;
  revealedEventIds: ReadonlySet<string>;
  sort: TimelineEventSort;
};

export function EventStreamView({
  currentPage,
  events,
  guardEnabled,
  hasNextPage,
  isAllLines,
  onOpenEvent,
  onRevealEvent,
  renderActions,
  revealedEventIds,
  sort,
}: EventStreamViewProps) {
  const t = useTranslations("timeline");

  const isChapterGrouped = sort === "book_order";
  const showsStoryTimeDividers = !isAllLines && sort === "timeline_order";
  const contextMode = resolveContextMode({ isAllLines, sort });
  const groups = isChapterGrouped ? groupEventsByChapter(events) : null;
  const sequence = groups === null ? events : groups.flatMap((group) => group.events);
  const markerIndex = isChapterGrouped
    ? readingMarkerIndex({ currentPage, events: sequence, hasNextPage })
    : null;

  function renderEvent(event: TimelineEventView, hasConnector: boolean): ReactNode {
    const reason = revealedEventIds.has(event.id)
      ? null
      : eventGuardReason({ currentPage, event, guardEnabled });

    return (
      <StreamRow colorKey={event.timelineColorKey} hasConnector={hasConnector} key={event.id}>
        {reason === null ? (
          <EventCard
            actions={renderActions?.(event)}
            contextMode={contextMode}
            event={event}
            onOpen={onOpenEvent}
            showTimelineName={isAllLines}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <UiIcon name="eye-off" size={15} />
              {t(GUARD_REASON_LABEL_KEYS[reason])}
            </span>
            <Button onClick={() => onRevealEvent(event.id)} size="sm" variant="secondary">
              <UiIcon name="eye" size={14} />
              {t("guarded.reveal")}
            </Button>
          </div>
        )}
      </StreamRow>
    );
  }

  const nodes: ReactNode[] = [];
  let index = 0;

  function pushMarker() {
    if (markerIndex === null || index !== markerIndex || currentPage === null) return;
    nodes.push(<PositionMarker key={`marker-${index}`} page={currentPage} />);
  }

  if (groups === null) {
    let previousStoryTime: Nullable<string> = null;
    for (const event of events) {
      pushMarker();
      if (
        showsStoryTimeDividers &&
        event.storyTime !== null &&
        event.storyTime !== previousStoryTime
      ) {
        nodes.push(<StoryTimeDivider key={`story-${event.id}`} label={event.storyTime} />);
      }
      if (event.storyTime !== null) previousStoryTime = event.storyTime;
      nodes.push(renderEvent(event, index < events.length - 1));
      index += 1;
    }
  } else {
    for (const group of groups) {
      nodes.push(
        <ChapterHeader
          chapter={group.chapter}
          key={`chapter-${group.key}`}
          noChapterLabel={t("noChapter")}
        />,
      );
      group.events.forEach((event, positionInGroup) => {
        pushMarker();
        nodes.push(renderEvent(event, positionInGroup < group.events.length - 1));
        index += 1;
      });
    }
  }

  pushMarker();

  return <div className="flex flex-col">{nodes}</div>;
}

function ChapterHeader({
  chapter,
  noChapterLabel,
}: {
  chapter: Nullable<string>;
  noChapterLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-2 first:pt-0">
      <span
        className={cn(
          "text-xs font-medium",
          chapter === null ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {chapter ?? noChapterLabel}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

function resolveContextMode({
  isAllLines,
  sort,
}: {
  isAllLines: boolean;
  sort: TimelineEventSort;
}): EventCardContextMode {
  if (sort === "book_order") return "withoutChapter";
  if (!isAllLines && sort === "timeline_order") return "withoutStoryTime";
  return "full";
}

function StoryTimeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-6 text-xs text-muted-foreground">
      <UiIcon name="clock" size={12} />
      <span>{label}</span>
    </div>
  );
}

function StreamRow({
  children,
  colorKey,
  hasConnector,
}: {
  children: ReactNode;
  colorKey: TimelineColorKey;
  hasConnector: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-3 flex-col items-center pt-2.5">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full ring-4 ring-card"
          style={markerStyle(colorKey)}
        />
        {hasConnector ? <span aria-hidden className="mt-1 w-px flex-1 bg-border" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-3">{children}</div>
    </div>
  );
}
