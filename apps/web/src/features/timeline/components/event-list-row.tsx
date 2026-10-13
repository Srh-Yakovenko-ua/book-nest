import type { Nullable, TimelineColorKey, TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { EventGuardReason } from "../model/event-guard";

import { markerStyle } from "../model/color-key";
import { GUARD_REASON_LABEL_KEYS } from "../model/event-guard";
import { eventTypeMeta } from "../model/event-type-meta";
import { TimelineImportanceChip } from "./timeline-importance-chip";
import { TimelineLineChip } from "./timeline-line-chip";
import { TruncatedText } from "./truncated-text";

type EventListRowProps = {
  actions?: ReactNode;
  event: TimelineEventView;
  gridTemplate: string;
  guardReason: Nullable<EventGuardReason>;
  isAllLines: boolean;
  onOpen: (eventId: string) => void;
  onReveal: (eventId: string) => void;
};

const LIST_ROW_STYLES = {
  badgeRow: "flex flex-wrap items-center gap-1.5",
  eventCell: "flex min-w-0 flex-col gap-1",
  guardIconHolder:
    "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-icon",
  importanceCell: "md:-mt-px",
  marker: "size-3 shrink-0 rounded-full ring-2 ring-card",
  markerOffset: "md:mt-1",
  timelineBadgeTrigger: "pointer-events-auto inline-flex max-w-44 min-w-0",
  trailingColumns: "md:col-span-3",
  typeCell: "inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground md:mt-0.5",
} as const;

export function EventListRow({
  actions,
  event,
  gridTemplate,
  guardReason,
  isAllLines,
  onOpen,
  onReveal,
}: EventListRowProps) {
  const t = useTranslations("timeline");
  const typeMeta = eventTypeMeta(event.eventType);

  if (guardReason !== null) {
    return (
      <div className={cn("flex flex-wrap items-center py-2", gridTemplate, "md:items-center")}>
        {isAllLines ? <TimelineMarker colorKey={event.timelineColorKey} /> : null}
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden className={LIST_ROW_STYLES.guardIconHolder}>
            <UiIcon name="eye-off" size={13} />
          </span>
          <span className="min-w-0 md:truncate">{t(GUARD_REASON_LABEL_KEYS[guardReason])}</span>
        </span>
        <span className={cn("ml-auto flex justify-end", LIST_ROW_STYLES.trailingColumns)}>
          <Button onClick={() => onReveal(event.id)} size="sm">
            {t("guarded.reveal")}
          </Button>
        </span>
      </div>
    );
  }

  const pageLabel = event.pageNumber === null ? null : t("list.page", { page: event.pageNumber });
  const context = joinContext([event.chapter, pageLabel, event.storyTime, event.location]);
  const mobileContext = joinContext([event.chapter, event.storyTime, event.location]);

  return (
    <div className="relative transition-colors hover:bg-secondary/40 has-[button:focus-visible]:bg-secondary/40">
      <button
        aria-label={event.title}
        className="absolute inset-0 z-0 cursor-pointer outline-none"
        onClick={() => onOpen(event.id)}
        type="button"
      />

      <div className={cn("pointer-events-none relative z-10 hidden py-3", gridTemplate)}>
        {isAllLines ? (
          <TimelineMarker
            className={LIST_ROW_STYLES.markerOffset}
            colorKey={event.timelineColorKey}
            name={event.timelineName}
          />
        ) : null}
        <div className={LIST_ROW_STYLES.eventCell}>
          <TruncatedText className="text-sm font-medium text-foreground" text={event.title} />
          {event.summary === null ? null : (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{event.summary}</span>
          )}
          {context === null ? null : (
            <TruncatedText className="text-xs text-muted-foreground" text={context} />
          )}
          {event.threadStatus === null && !isAllLines ? null : (
            <div className={LIST_ROW_STYLES.badgeRow}>
              <ThreadBadge status={event.threadStatus} />
              {isAllLines ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={LIST_ROW_STYLES.timelineBadgeTrigger}>
                      <TimelineLineChip
                        className="min-w-0"
                        colorKey={event.timelineColorKey}
                        name={event.timelineName}
                        size="compact"
                        withMarker={false}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{event.timelineName}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          )}
        </div>
        <span className={LIST_ROW_STYLES.typeCell}>
          <UiIcon aria-hidden className="shrink-0" name={typeMeta.icon} size={13} />
          <TruncatedText text={t(typeMeta.labelKey)} />
        </span>
        <TimelineImportanceChip
          className={LIST_ROW_STYLES.importanceCell}
          importance={event.importance}
        />
        <span aria-hidden />
      </div>

      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5 px-3 py-3 pr-10 md:hidden">
        <span className="line-clamp-2 text-sm font-medium text-foreground">{event.title}</span>
        {event.summary === null ? null : (
          <span className="line-clamp-2 text-xs text-muted-foreground">{event.summary}</span>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon aria-hidden className="shrink-0" name={typeMeta.icon} size={13} />
            {t("card.type", { value: t(typeMeta.labelKey) })}
          </span>
          <TimelineImportanceChip className="shrink-0" importance={event.importance} withLabel />
          <ThreadBadge status={event.threadStatus} />
        </div>
        {mobileContext === null ? null : (
          <span className="line-clamp-2 text-xs text-muted-foreground">{mobileContext}</span>
        )}
        {isAllLines || pageLabel !== null ? (
          <div className="flex items-center gap-2">
            {isAllLines ? (
              <TimelineLineChip
                className="min-w-0"
                colorKey={event.timelineColorKey}
                name={event.timelineName}
                size="compact"
              />
            ) : null}
            {pageLabel === null ? null : (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                {pageLabel}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {actions === undefined ? null : (
        <div className="pointer-events-auto absolute top-2 right-2 z-20">{actions}</div>
      )}
    </div>
  );
}

function joinContext(parts: Nullable<string>[]): Nullable<string> {
  const present = parts.filter((part): part is string => part !== null);
  return present.length === 0 ? null : present.join(" · ");
}

function ThreadBadge({ status }: { status: TimelineEventView["threadStatus"] }) {
  const t = useTranslations("timeline.thread");
  if (status === null) return null;
  return (
    <Badge className="w-fit" variant={status === "open" ? "warning" : "success"}>
      {t(status === "open" ? "open" : "resolved")}
    </Badge>
  );
}

function TimelineMarker({
  className,
  colorKey,
  name,
}: {
  className?: string;
  colorKey: TimelineColorKey;
  name?: string;
}) {
  if (name === undefined) {
    return <span aria-hidden className={LIST_ROW_STYLES.marker} style={markerStyle(colorKey)} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={name}
          className={cn("pointer-events-auto", LIST_ROW_STYLES.marker, className)}
          role="img"
          style={markerStyle(colorKey)}
        />
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
