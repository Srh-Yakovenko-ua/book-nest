import type { TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

import { eventTypeMeta } from "../model/event-type-meta";
import { TimelineImportanceChip } from "./timeline-importance-chip";
import { TimelineLineChip } from "./timeline-line-chip";

const THREAD_BADGE_META = {
  open: { icon: "help-circle", labelKey: "open", variant: "warning" },
  resolved: { icon: "check-circle", labelKey: "resolved", variant: "success" },
} as const;

export type EventCardContextMode = "full" | "withoutChapter" | "withoutStoryTime";

type ContextPart = {
  icon: "book" | "clock" | "map-pin";
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
  const context = buildContextParts(event, contextMode);

  return (
    <div className="relative rounded-xl border border-border bg-card p-3.5 shadow-card transition-[border-color,box-shadow] hover:border-accent-border hover:shadow-soft has-[button:focus-visible]:border-ring">
      <button
        aria-label={event.title}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl outline-none"
        onClick={() => onOpen(event.id)}
        type="button"
      />
      <div className="pointer-events-none relative z-10 flex gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-icon"
        >
          <UiIcon name={typeMeta.icon} size={20} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-heading text-[15px] leading-snug font-semibold text-ink">
                {event.title}
              </p>
              {actions === undefined ? null : (
                <div className="pointer-events-auto relative z-20 shrink-0">{actions}</div>
              )}
            </div>

            {event.summary === null ? null : (
              <p className="line-clamp-2 text-sm leading-relaxed text-foreground/85">
                {event.summary}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="min-w-0 truncate text-xs font-medium text-foreground">
                {t("card.type", { value: t(typeMeta.labelKey) })}
              </span>
              <TimelineImportanceChip importance={event.importance} withLabel />
              <ThreadBadge status={event.threadStatus} />
            </div>

            {context.length === 0 ? null : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                {context.map((part) => (
                  <span className="inline-flex min-w-0 items-center gap-1" key={part.key}>
                    <UiIcon aria-hidden className="shrink-0" name={part.icon} size={12} />
                    <span className="truncate">{part.value}</span>
                  </span>
                ))}
              </div>
            )}

            {showTimelineName || event.pageNumber !== null ? (
              <div className="flex min-w-0 items-center gap-3">
                {showTimelineName ? (
                  <TimelineLineChip
                    className="min-w-0"
                    colorKey={event.timelineColorKey}
                    name={event.timelineName}
                    size="compact"
                  />
                ) : null}
                {event.pageNumber === null ? null : (
                  <p className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <UiIcon className="text-icon" name="book" size={13} />
                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                      {t("list.page", { page: event.pageNumber })}
                    </span>
                  </p>
                )}
              </div>
            ) : null}
          </div>
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
  if (event.storyTime !== null && mode !== "withoutStoryTime") {
    parts.push({ icon: "clock", key: "storyTime", value: event.storyTime });
  }
  if (event.location !== null) {
    parts.push({ icon: "map-pin", key: "location", value: event.location });
  }
  return parts;
}

function ThreadBadge({ status }: { status: TimelineEventView["threadStatus"] }) {
  const t = useTranslations("timeline.thread");
  if (status === null) return null;

  const meta = THREAD_BADGE_META[status];

  return (
    <Badge variant={meta.variant}>
      <UiIcon name={meta.icon} size={12} />
      {t(meta.labelKey)}
    </Badge>
  );
}
