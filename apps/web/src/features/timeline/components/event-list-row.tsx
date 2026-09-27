import type { Nullable, TimelineEventView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { EventGuardReason } from "../model/event-guard";

import { markerStyle } from "../model/color-key";
import { GUARD_REASON_LABEL_KEYS } from "../model/event-guard";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";

type EventListRowProps = {
  actions?: ReactNode;
  event: TimelineEventView;
  gridTemplate: string;
  guardReason: Nullable<EventGuardReason>;
  isAllLines: boolean;
  onOpen: (eventId: string) => void;
  onReveal: (eventId: string) => void;
  position: number;
};

export function EventListRow({
  actions,
  event,
  gridTemplate,
  guardReason,
  isAllLines,
  onOpen,
  onReveal,
  position,
}: EventListRowProps) {
  const t = useTranslations("timeline");
  const typeMeta = eventTypeMeta(event.eventType);
  const importance = importanceMeta(event.importance);

  if (guardReason !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-3 py-3">
        <span className="text-sm text-muted-foreground tabular-nums">{position}</span>
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={markerStyle(event.timelineColorKey)}
        />
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <UiIcon name="eye-off" size={15} />
          {t(GUARD_REASON_LABEL_KEYS[guardReason])}
        </span>
        <Button
          className="ml-auto"
          onClick={() => onReveal(event.id)}
          size="sm"
          variant="secondary"
        >
          <UiIcon name="eye" size={14} />
          {t("guarded.reveal")}
        </Button>
      </div>
    );
  }

  const context = buildContext(event, (page) => t("list.page", { page }));

  return (
    <div className="relative transition-colors hover:bg-secondary/40 has-[button:focus-visible]:bg-secondary/40">
      <button
        aria-label={event.title}
        className="absolute inset-0 z-0 cursor-pointer outline-none"
        onClick={() => onOpen(event.id)}
        type="button"
      />

      <div className={cn("pointer-events-none relative z-10 hidden py-2.5", gridTemplate)}>
        <span className="text-sm text-muted-foreground tabular-nums">{position}</span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{event.title}</span>
          {event.summary === null ? null : (
            <span className="truncate text-xs text-muted-foreground">{event.summary}</span>
          )}
          {context === null ? null : (
            <span className="truncate text-xs text-muted-foreground lg:hidden">{context}</span>
          )}
          <ThreadBadge status={event.threadStatus} />
        </div>
        <span className="hidden truncate text-xs text-muted-foreground lg:block">
          {context ?? "—"}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <UiIcon name={typeMeta.icon} size={13} />
          <span className="truncate">{t(typeMeta.labelKey)}</span>
        </span>
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-xs font-medium",
            importance.badgeClass,
          )}
        >
          {t(importance.labelKey)}
        </span>
        {isAllLines ? (
          <span className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={markerStyle(event.timelineColorKey)}
            />
            <span className="truncate">{event.timelineName}</span>
          </span>
        ) : null}
        <span aria-hidden />
      </div>

      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5 px-3 py-3 pr-10 md:hidden">
        <span className="line-clamp-2 text-sm font-medium text-foreground">
          <span className="text-muted-foreground tabular-nums">{position}. </span>
          {event.title}
        </span>
        {event.summary === null ? null : (
          <span className="line-clamp-2 text-xs text-muted-foreground">{event.summary}</span>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <ThreadBadge status={event.threadStatus} />
        </div>
        {context === null ? null : (
          <span className="line-clamp-2 text-xs text-muted-foreground">{context}</span>
        )}
        {isAllLines ? (
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

      {actions === undefined ? null : (
        <div className="pointer-events-auto absolute top-2 right-2 z-20">{actions}</div>
      )}
    </div>
  );
}

function buildContext(
  event: TimelineEventView,
  formatPage: (page: number) => string,
): Nullable<string> {
  const parts: string[] = [];
  if (event.chapter !== null) parts.push(event.chapter);
  if (event.pageNumber !== null) parts.push(formatPage(event.pageNumber));
  if (event.location !== null) parts.push(event.location);
  if (event.storyTime !== null) parts.push(event.storyTime);
  return parts.length === 0 ? null : parts.join(" · ");
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
