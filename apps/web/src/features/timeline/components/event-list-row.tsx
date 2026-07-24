import type { TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { markerClass } from "../model/color-key";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";

type EventListRowProps = {
  actions?: ReactNode;
  event: TimelineEventView;
  gridTemplate: string;
  onOpen: (eventId: string) => void;
  position: number;
  showTimelineName: boolean;
};

export function EventListRow({
  actions,
  event,
  gridTemplate,
  onOpen,
  position,
  showTimelineName,
}: EventListRowProps) {
  const t = useTranslations("timeline");
  const typeMeta = eventTypeMeta(event.eventType);
  const importance = importanceMeta(event.importance);
  const place = buildPlace(event);

  return (
    <div className="relative transition-colors hover:bg-secondary/40 has-[button:focus-visible]:bg-secondary/40">
      <button
        aria-label={event.title}
        className="absolute inset-0 z-0 cursor-pointer outline-none"
        onClick={() => onOpen(event.id)}
        type="button"
      />

      <div
        className={cn(
          "pointer-events-none relative z-10 hidden items-center gap-3 px-3 py-2.5 lg:grid",
          gridTemplate,
        )}
      >
        <span className="text-sm text-muted-foreground tabular-nums">{position}</span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{event.title}</span>
          {event.summary === null ? null : (
            <span className="truncate text-xs text-muted-foreground">{event.summary}</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <UiIcon name={typeMeta.icon} size={13} />
          <span className="truncate">{t(typeMeta.labelKey)}</span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{place ?? "—"}</span>
        {showTimelineName ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", markerClass(event.timelineColorKey))}
            />
            <span className="truncate">{event.timelineName}</span>
          </span>
        ) : null}
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-xs font-medium",
            importance.badgeClass,
          )}
        >
          {t(importance.labelKey)}
        </span>
      </div>

      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5 px-3 py-3 lg:hidden">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon name={typeMeta.icon} size={13} />
            {t(typeMeta.labelKey)}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              importance.badgeClass,
            )}
          >
            {t(importance.labelKey)}
          </span>
        </div>
        <span className="text-sm font-medium text-foreground">
          <span className="text-muted-foreground tabular-nums">{position}. </span>
          {event.title}
        </span>
        {event.summary === null ? null : (
          <span className="line-clamp-2 text-xs text-muted-foreground">{event.summary}</span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {place === null ? null : <span>{place}</span>}
          {showTimelineName ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", markerClass(event.timelineColorKey))}
              />
              {event.timelineName}
            </span>
          ) : null}
        </div>
      </div>

      {actions === undefined ? null : (
        <div className="pointer-events-auto absolute top-2 right-2 z-20">{actions}</div>
      )}
    </div>
  );
}

function buildPlace(event: TimelineEventView): null | string {
  const parts: string[] = [];
  if (event.chapter !== null) parts.push(event.chapter);
  if (event.pageNumber !== null) parts.push(String(event.pageNumber));
  return parts.length === 0 ? null : parts.join(" · ");
}
