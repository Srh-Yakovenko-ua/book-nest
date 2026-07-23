import type { TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { markerClass } from "../model/color-key";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";

type EventCardProps = {
  actions?: ReactNode;
  event: TimelineEventView;
  onOpen: (eventId: string) => void;
  showTimelineName: boolean;
};

type MetaPart = {
  icon: "book" | "clock" | "globe" | "pages";
  key: string;
  value: string;
};

export function EventCard({ actions, event, onOpen, showTimelineName }: EventCardProps) {
  const t = useTranslations("timeline");
  const typeMeta = eventTypeMeta(event.eventType);
  const importance = importanceMeta(event.importance);
  const meta = buildMetaParts(event);

  return (
    <div className="relative rounded-lg border border-border bg-card p-3 transition-colors hover:border-accent-border has-[button:focus-visible]:border-ring">
      <button
        aria-label={event.title}
        className="absolute inset-0 z-0 cursor-pointer rounded-lg outline-none"
        onClick={() => onOpen(event.id)}
        type="button"
      />
      <div className="pointer-events-none relative z-10 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-icon">
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
          {actions === undefined ? null : (
            <div className="pointer-events-auto relative z-20 shrink-0">{actions}</div>
          )}
        </div>

        <p className="text-sm font-medium text-foreground">{event.title}</p>

        {event.summary === null ? null : (
          <p className="line-clamp-2 text-sm text-muted-foreground">{event.summary}</p>
        )}

        {meta.length === 0 ? null : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {meta.map((part) => (
              <span className="inline-flex items-center gap-1" key={part.key}>
                <UiIcon name={part.icon} size={12} />
                {part.value}
              </span>
            ))}
          </div>
        )}

        {showTimelineName ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", markerClass(event.timelineColorKey))}
            />
            {event.timelineName}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function buildMetaParts(event: TimelineEventView): MetaPart[] {
  const parts: MetaPart[] = [];
  if (event.chapter !== null) parts.push({ icon: "book", key: "chapter", value: event.chapter });
  if (event.pageNumber !== null) {
    parts.push({ icon: "pages", key: "page", value: String(event.pageNumber) });
  }
  if (event.storyTime !== null) {
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
