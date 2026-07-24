import type { TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { EventListRow } from "./event-list-row";

type EventListViewProps = {
  events: TimelineEventView[];
  onOpenEvent: (eventId: string) => void;
  renderActions?: (event: TimelineEventView) => ReactNode;
  showTimelineName: boolean;
};

export function EventListView({
  events,
  onOpenEvent,
  renderActions,
  showTimelineName,
}: EventListViewProps) {
  const t = useTranslations("timeline.list");

  const gridTemplate = showTimelineName
    ? "lg:grid-cols-[2.25rem_minmax(0,1fr)_8rem_9rem_8rem_5.5rem]"
    : "lg:grid-cols-[2.25rem_minmax(0,1fr)_8rem_9rem_5.5rem]";

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className={cn(
          "hidden gap-3 border-b border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid",
          gridTemplate,
        )}
      >
        <span>{t("number")}</span>
        <span>{t("event")}</span>
        <span>{t("type")}</span>
        <span>{t("place")}</span>
        {showTimelineName ? <span>{t("timeline")}</span> : null}
        <span>{t("importance")}</span>
      </div>

      <div className="divide-y divide-border">
        {events.map((event, position) => (
          <EventListRow
            actions={renderActions?.(event)}
            event={event}
            gridTemplate={gridTemplate}
            key={event.id}
            onOpen={onOpenEvent}
            position={position + 1}
            showTimelineName={showTimelineName}
          />
        ))}
      </div>
    </div>
  );
}
