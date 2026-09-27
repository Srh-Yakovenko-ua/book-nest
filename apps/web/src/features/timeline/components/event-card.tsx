import type { TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { markerStyle } from "../model/color-key";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";

export type EventCardContextMode = "full" | "withoutChapter" | "withoutStoryTime";

type ContextPart = {
  icon: "book" | "clock" | "globe" | "pages";
  key: string;
  value: string;
};

type EventCardProps = {
  actions?: ReactNode;
  contextMode: EventCardContextMode;
  event: TimelineEventView;
  onOpen: (eventId: string) => void;
  showTimelineName: boolean;
};

export function EventCard({
  actions,
  contextMode,
  event,
  onOpen,
  showTimelineName,
}: EventCardProps) {
  const t = useTranslations("timeline");
  const typeMeta = eventTypeMeta(event.eventType);
  const importance = importanceMeta(event.importance);
  const context = buildContextParts(event, contextMode);

  return (
    <div className="relative rounded-lg border border-border bg-card p-3 transition-colors hover:border-accent-border has-[button:focus-visible]:border-ring">
      <button
        aria-label={event.title}
        className="absolute inset-0 z-0 cursor-pointer rounded-lg outline-none"
        onClick={() => onOpen(event.id)}
        type="button"
      />
      <div className="pointer-events-none relative z-10 flex gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-icon"
        >
          <UiIcon name={typeMeta.icon} size={18} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm leading-snug font-semibold text-foreground">
              {event.title}
            </p>
            {actions === undefined ? null : (
              <div className="pointer-events-auto relative z-20 shrink-0">{actions}</div>
            )}
          </div>

          {event.summary === null ? null : (
            <p className="line-clamp-2 text-sm text-muted-foreground">{event.summary}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <UiIcon name={typeMeta.icon} size={13} />
              {t(typeMeta.labelKey)}
            </span>
            <span
              className={cn("rounded-full px-2 py-0.5 text-xs font-medium", importance.badgeClass)}
            >
              {t(importance.labelKey)}
            </span>
            <ThreadBadge status={event.threadStatus} />
          </div>

          {context.length === 0 ? null : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {context.map((part) => (
                <span className="inline-flex min-w-0 items-center gap-1" key={part.key}>
                  <UiIcon name={part.icon} size={12} />
                  <span className="truncate">{part.value}</span>
                </span>
              ))}
            </div>
          )}

          {showTimelineName ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={markerStyle(event.timelineColorKey)}
              />
              {event.timelineName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildContextParts(event: TimelineEventView, mode: EventCardContextMode): ContextPart[] {
  const parts: ContextPart[] = [];
  if (event.chapter !== null && mode !== "withoutChapter") {
    parts.push({ icon: "book", key: "chapter", value: event.chapter });
  }
  if (event.pageNumber !== null) {
    parts.push({ icon: "pages", key: "page", value: String(event.pageNumber) });
  }
  if (event.storyTime !== null && mode !== "withoutStoryTime") {
    parts.push({ icon: "clock", key: "storyTime", value: event.storyTime });
  }
  if (event.location !== null) {
    parts.push({ icon: "globe", key: "location", value: event.location });
  }
  return parts;
}

function ThreadBadge({ status }: { status: TimelineEventView["threadStatus"] }) {
  const t = useTranslations("timeline.thread");
  if (status === null) return null;
  if (status === "open") {
    return (
      <Badge variant="warning">
        <UiIcon name="help-circle" size={12} />
        {t("open")}
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <UiIcon name="check-circle" size={12} />
      {t("resolved")}
    </Badge>
  );
}
