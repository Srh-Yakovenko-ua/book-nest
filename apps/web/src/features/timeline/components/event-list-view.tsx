import type { Nullable, TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { eventGuardReason } from "../model/event-guard";
import { EventListRow } from "./event-list-row";

type EventListViewProps = {
  currentPage: Nullable<number>;
  events: TimelineEventView[];
  guardEnabled: boolean;
  isAllLines: boolean;
  onOpenEvent: (eventId: string) => void;
  onRevealEvent: (eventId: string) => void;
  renderActions?: (event: TimelineEventView) => ReactNode;
  revealedEventIds: ReadonlySet<string>;
};

const LIST_GRID = {
  allLines:
    "md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_6rem_2.75rem] lg:grid-cols-[2.5rem_minmax(0,1fr)_10rem_8rem_6.5rem_9rem_2.75rem]",
  base: "gap-3 px-3 md:grid md:items-center",
  singleLine:
    "md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_6rem_2.75rem] lg:grid-cols-[2.5rem_minmax(0,1fr)_10rem_8rem_6.5rem_2.75rem]",
} as const;

export function EventListView({
  currentPage,
  events,
  guardEnabled,
  isAllLines,
  onOpenEvent,
  onRevealEvent,
  renderActions,
  revealedEventIds,
}: EventListViewProps) {
  const t = useTranslations("timeline.list");
  const gridTemplate = cn(LIST_GRID.base, isAllLines ? LIST_GRID.allLines : LIST_GRID.singleLine);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className={cn(
          "hidden border-b border-border bg-secondary/40 py-2 text-xs font-medium text-muted-foreground",
          gridTemplate,
        )}
      >
        <span>{t("number")}</span>
        <span>{t("event")}</span>
        <span className="hidden lg:block">{t("context")}</span>
        <span>{t("type")}</span>
        <span>{t("importance")}</span>
        {isAllLines ? <span className="hidden lg:block">{t("timeline")}</span> : null}
        <span>
          <span className="sr-only">{t("actions")}</span>
        </span>
      </div>

      <div className="divide-y divide-border">
        {events.map((event, position) => (
          <EventListRow
            actions={renderActions?.(event)}
            event={event}
            gridTemplate={gridTemplate}
            guardReason={
              revealedEventIds.has(event.id)
                ? null
                : eventGuardReason({ currentPage, event, guardEnabled })
            }
            isAllLines={isAllLines}
            key={event.id}
            onOpen={onOpenEvent}
            onReveal={onRevealEvent}
            position={position + 1}
          />
        ))}
      </div>
    </div>
  );
}
