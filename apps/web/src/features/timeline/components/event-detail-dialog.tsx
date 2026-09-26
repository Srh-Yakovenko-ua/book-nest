"use client";

import type {
  Nullable,
  TimelineEventDetailView,
  TimelineEventPreview,
  TimelineThreadStatus,
} from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { EventGuardReason } from "../model/event-guard";

import { useTimelineEvent } from "../api/use-timeline-event";
import { markerStyle } from "../model/color-key";
import { eventGuardReason, GUARD_REASON_LABEL_KEYS } from "../model/event-guard";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";

type EventDetailDialogProps = {
  currentPage: Nullable<number>;
  eventId: Nullable<string>;
  guardEnabled: boolean;
  onDelete: (event: TimelineEventDetailView) => void;
  onEdit: (event: TimelineEventDetailView) => void;
  onOpenChange: (open: boolean) => void;
  onRevealEvent: (eventId: string) => void;
  revealedEventIds: ReadonlySet<string>;
};

export function EventDetailDialog({
  currentPage,
  eventId,
  guardEnabled,
  onDelete,
  onEdit,
  onOpenChange,
  onRevealEvent,
  revealedEventIds,
}: EventDetailDialogProps) {
  const t = useTranslations("timeline");
  const [rootEventId, setRootEventId] = useState(eventId);
  const [navigationStack, setNavigationStack] = useState<string[]>(
    eventId === null ? [] : [eventId],
  );

  if (rootEventId !== eventId) {
    setRootEventId(eventId);
    setNavigationStack(eventId === null ? [] : [eventId]);
  }

  const query = useTimelineEvent(navigationStack.at(-1) ?? null);
  const event = query.data;
  const canGoBack = navigationStack.length > 1;

  function goBack() {
    setNavigationStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  }

  function navigateTo(targetEventId: string) {
    setNavigationStack((stack) => [...stack, targetEventId]);
  }

  const guardReason =
    event === undefined || revealedEventIds.has(event.id)
      ? null
      : eventGuardReason({ currentPage, event, guardEnabled });

  return (
    <Dialog onOpenChange={onOpenChange} open={eventId !== null}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[86vh] sm:max-w-2xl">
        {event === undefined ? (
          <DialogPlaceholder
            isError={query.isError}
            onRetry={() => void query.refetch()}
            retryLabel={t("states.retry")}
            title={t(query.isError ? "states.errorText" : "states.loading")}
          />
        ) : guardReason !== null ? (
          <GuardedEventBody
            canGoBack={canGoBack}
            onBack={goBack}
            onReveal={() => onRevealEvent(event.id)}
            reason={guardReason}
          />
        ) : (
          <EventDetailBody
            canGoBack={canGoBack}
            event={event}
            onBack={goBack}
            onDelete={onDelete}
            onEdit={onEdit}
            onNavigate={navigateTo}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackButton({ canGoBack, onBack }: { canGoBack: boolean; onBack: () => void }) {
  const t = useTranslations("timeline");

  if (!canGoBack) return null;

  return (
    <Button className="-ml-2 self-start" onClick={onBack} size="sm" type="button" variant="ghost">
      <UiIcon name="arrow-left" size={14} />
      {t("detail.back")}
    </Button>
  );
}

function DialogPlaceholder({
  isError,
  onRetry,
  retryLabel,
  title,
}: {
  isError: boolean;
  onRetry: () => void;
  retryLabel: string;
  title: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <UiIcon
        className={isError ? "text-destructive" : "animate-spin text-muted-foreground"}
        name={isError ? "alert-circle" : "refresh"}
        size={24}
      />
      <p className="text-sm text-muted-foreground">{title}</p>
      {isError ? (
        <Button onClick={onRetry} size="sm" variant="secondary">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

function EventDetailBody({
  canGoBack,
  event,
  onBack,
  onDelete,
  onEdit,
  onNavigate,
}: {
  canGoBack: boolean;
  event: TimelineEventDetailView;
  onBack: () => void;
  onDelete: (event: TimelineEventDetailView) => void;
  onEdit: (event: TimelineEventDetailView) => void;
  onNavigate: (eventId: string) => void;
}) {
  const t = useTranslations("timeline");
  const tType = useTranslations("timeline.eventType");
  const tForm = useTranslations("timeline.form");
  const typeMeta = eventTypeMeta(event.eventType);
  const importance = importanceMeta(event.importance);

  const contextItems = [
    { label: tForm("chapterLabel"), value: event.chapter },
    {
      label: tForm("pageLabel"),
      value: event.pageNumber === null ? null : String(event.pageNumber),
    },
    { label: tForm("storyTimeLabel"), value: event.storyTime },
    { label: tForm("locationLabel"), value: event.location },
  ].filter((item): item is { label: string; value: string } => item.value !== null);

  const relations = [
    ...event.relations.outgoing.map((entry) => ({
      entry,
      label: t(`relationType.${entry.relationType}`),
    })),
    ...event.relations.incoming.map((entry) => ({
      entry,
      label: t(`relationTypeInverse.${entry.relationType}`),
    })),
  ];

  return (
    <>
      <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 sm:px-6">
        <BackButton canGoBack={canGoBack} onBack={onBack} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-icon">
            <UiIcon name={typeMeta.icon} size={13} />
            {tType(event.eventType)}
          </span>
          <span
            className={cn("rounded-full px-2 py-0.5 text-xs font-medium", importance.badgeClass)}
          >
            {t(importance.labelKey)}
          </span>
          <ThreadBadge status={event.threadStatus} />
          {event.isSpoiler ? (
            <Badge variant="warning">
              <UiIcon name="eye-off" size={12} />
              {t("spoiler.label")}
            </Badge>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={markerStyle(event.timelineColorKey)}
            />
            {event.timelineName}
          </span>
        </div>
        <DialogTitle>{event.title}</DialogTitle>
        {event.summary === null ? null : <DialogDescription>{event.summary}</DialogDescription>}
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
        {contextItems.length === 0 ? null : (
          <section className="rounded-lg border border-border bg-secondary/30 p-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("detail.context")}
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              {contextItems.map((item) => (
                <div className="flex flex-col gap-0.5" key={item.label}>
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {event.description === null ? null : (
          <Field title={t("detail.description")}>
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
              {event.description}
            </p>
          </Field>
        )}

        {event.personalNote === null ? null : (
          <Field title={tForm("personalNoteLabel")}>
            <div className="flex gap-2.5 rounded-lg border border-accent-border bg-accent/40 p-3">
              <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name="note" size={15} />
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                {event.personalNote}
              </p>
            </div>
          </Field>
        )}

        {event.resolvedBy === null ? null : (
          <Field title={t("thread.resolvedBy")}>
            <EventLinkRow event={event.resolvedBy} onNavigate={onNavigate} />
          </Field>
        )}

        {event.resolves.length === 0 ? null : (
          <Field title={t("detail.resolves")}>
            <div className="flex flex-col gap-1.5">
              {event.resolves.map((preview) => (
                <EventLinkRow event={preview} key={preview.id} onNavigate={onNavigate} />
              ))}
            </div>
          </Field>
        )}

        {relations.length === 0 ? null : (
          <Field title={t("detail.related")}>
            <div className="flex flex-col gap-1.5">
              {relations.map(({ entry, label }) => (
                <EventLinkRow
                  event={entry.event}
                  key={entry.id}
                  label={label}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </Field>
        )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            {t("detail.close")}
          </Button>
        </DialogClose>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button onClick={() => onDelete(event)} type="button" variant="destructive">
            <UiIcon name="trash" size={16} />
            {t("detail.delete")}
          </Button>
          <Button onClick={() => onEdit(event)} type="button">
            <UiIcon name="edit" size={16} />
            {t("detail.edit")}
          </Button>
        </div>
      </div>
    </>
  );
}

function EventLinkRow({
  event,
  label,
  onNavigate,
}: {
  event: TimelineEventPreview;
  label?: string;
  onNavigate: (eventId: string) => void;
}) {
  const t = useTranslations("timeline");

  return (
    <button
      className="flex w-full cursor-pointer flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors outline-none hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={() => onNavigate(event.id)}
      type="button"
    >
      {label === undefined ? null : <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="flex items-center justify-between gap-2 text-sm text-foreground">
        <span className="truncate">{event.title}</span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground"
          name="arrow-right"
          size={14}
        />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span className="truncate">{event.timelineName}</span>
        {event.chapter === null ? null : <span className="truncate">{event.chapter}</span>}
        {event.pageNumber === null ? null : (
          <span className="tabular-nums">{t("list.page", { page: event.pageNumber })}</span>
        )}
      </span>
    </button>
  );
}

function Field({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function GuardedEventBody({
  canGoBack,
  onBack,
  onReveal,
  reason,
}: {
  canGoBack: boolean;
  onBack: () => void;
  onReveal: () => void;
  reason: EventGuardReason;
}) {
  const t = useTranslations("timeline");

  return (
    <>
      <DialogHeader className="shrink-0 px-5 py-4 pr-14 sm:px-6">
        <BackButton canGoBack={canGoBack} onBack={onBack} />
        <DialogTitle className="text-base">{t(GUARD_REASON_LABEL_KEYS[reason])}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-8 text-center sm:px-6">
        <UiIcon className="text-muted-foreground" name="eye-off" size={28} />
        <Button onClick={onReveal} type="button" variant="secondary">
          <UiIcon name="eye" size={16} />
          {t("guarded.reveal")}
        </Button>
      </div>

      <div className="flex shrink-0 justify-end border-t border-border px-5 py-4 sm:px-6">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            {t("detail.close")}
          </Button>
        </DialogClose>
      </div>
    </>
  );
}

function ThreadBadge({ status }: { status: Nullable<TimelineThreadStatus> }) {
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
