"use client";

import type { Nullable, TimelineColorKey, TimelineEventSort, TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { groupEventsByChapter } from "../model/chapter-grouping";
import { markerClass } from "../model/color-key";
import { isEventAhead, positionMarkerIndex } from "../model/reading-position";
import { EventCard } from "./event-card";
import { PositionMarker } from "./position-marker";

type EventStreamViewProps = {
  currentPage: Nullable<number>;
  events: TimelineEventView[];
  guardEnabled: boolean;
  onOpenEvent: (eventId: string) => void;
  renderActions?: (event: TimelineEventView) => ReactNode;
  showTimelineName: boolean;
  sort: TimelineEventSort;
};

export function EventStreamView({
  currentPage,
  events,
  guardEnabled,
  onOpenEvent,
  renderActions,
  showTimelineName,
  sort,
}: EventStreamViewProps) {
  const t = useTranslations("timeline");
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  const isGrouped = sort === "book_order";
  const showStoryTimeDivider = !showTimelineName && !isGrouped;
  const groups = isGrouped ? groupEventsByChapter(events) : null;
  const sequence = groups === null ? events : groups.flatMap((group) => group.events);
  const markerIndex = sort === "book_order" ? positionMarkerIndex(sequence, currentPage) : null;

  function reveal(eventId: string) {
    setRevealed((current) => new Set(current).add(eventId));
  }

  function renderEvent(event: TimelineEventView): ReactNode {
    const guarded = guardEnabled && isEventAhead(event, currentPage) && !revealed.has(event.id);
    return (
      <StreamRow colorKey={event.timelineColorKey} key={event.id}>
        {guarded ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2.5">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <UiIcon name="eye-off" size={15} />
              {t("guardHidden")}
            </span>
            <Button onClick={() => reveal(event.id)} size="sm" variant="secondary">
              <UiIcon name="eye" size={14} />
              {t("guardReveal")}
            </Button>
          </div>
        ) : (
          <EventCard
            actions={renderActions?.(event)}
            event={event}
            onOpen={onOpenEvent}
            showTimelineName={showTimelineName}
          />
        )}
      </StreamRow>
    );
  }

  const nodes: ReactNode[] = [];
  let index = 0;

  function pushMarker() {
    if (markerIndex !== null && index === markerIndex) {
      nodes.push(<PositionMarker key={`marker-${index}`} />);
    }
  }

  if (groups !== null) {
    for (const group of groups) {
      nodes.push(
        <ChapterHeader
          chapter={group.chapter}
          key={`chapter-${group.key}`}
          noChapterLabel={t("noChapter")}
        />,
      );
      for (const event of group.events) {
        pushMarker();
        nodes.push(renderEvent(event));
        index += 1;
      }
    }
  } else {
    let previousStoryTime: Nullable<string> = null;
    for (const event of events) {
      pushMarker();
      if (
        showStoryTimeDivider &&
        index > 0 &&
        event.storyTime !== null &&
        event.storyTime !== previousStoryTime
      ) {
        nodes.push(<StoryTimeDivider key={`story-${event.id}`} label={event.storyTime} />);
      }
      nodes.push(renderEvent(event));
      previousStoryTime = event.storyTime;
      index += 1;
    }
  }

  if (markerIndex !== null && index === markerIndex) {
    nodes.push(<PositionMarker key="marker-end" />);
  }

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
      <UiIcon className="text-muted-foreground" name="book" size={14} />
      <span className="text-xs font-semibold text-foreground">{chapter ?? noChapterLabel}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

function StoryTimeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 pl-6 text-xs text-muted-foreground">
      <UiIcon name="clock" size={12} />
      <span>{label}</span>
    </div>
  );
}

function StreamRow({
  children,
  colorKey,
}: {
  children: ReactNode;
  colorKey: Nullable<TimelineColorKey>;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-3 flex-col items-center pt-2.5">
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full ring-4 ring-card", markerClass(colorKey))}
        />
        <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="min-w-0 flex-1 pb-3">{children}</div>
    </div>
  );
}
