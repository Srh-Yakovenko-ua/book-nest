"use client";

import type {
  Nullable,
  TimelineEventDetailView,
  TimelineEventPreview,
  TimelineThreadStatus,
} from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useTimelineEvent } from "../api/use-timeline-event";
import { markerClass } from "../model/color-key";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";

type EventDetailDialogProps = {
  eventId: Nullable<string>;
  onDelete: (event: TimelineEventDetailView) => void;
  onEdit: (event: TimelineEventDetailView) => void;
  onNavigate: (eventId: string) => void;
  onOpenChange: (open: boolean) => void;
};

export function EventDetailDialog({
  eventId,
  onDelete,
  onEdit,
  onNavigate,
  onOpenChange,
}: EventDetailDialogProps) {
  const t = useTranslations("timeline");
  const query = useTimelineEvent(eventId);
  const event = query.data;

  return (
    <Dialog onOpenChange={onOpenChange} open={eventId !== null}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {event === undefined ? (
          <DialogPlaceholder
            isError={query.isError}
            onRetry={() => void query.refetch()}
            retryLabel={t("states.retry")}
            title={t(query.isError ? "states.errorText" : "states.loading")}
          />
        ) : (
          <EventDetailBody
            event={event}
            onDelete={onDelete}
            onEdit={onEdit}
            onNavigate={onNavigate}
          />
        )}
      </DialogContent>
    </Dialog>
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
    <div className="flex flex-col items-center gap-3 py-10 text-center">
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
  event,
  onDelete,
  onEdit,
  onNavigate,
}: {
  event: TimelineEventDetailView;
  onDelete: (event: TimelineEventDetailView) => void;
  onEdit: (event: TimelineEventDetailView) => void;
  onNavigate: (eventId: string) => void;
}) {
  const t = useTranslations("timeline");
  const tType = useTranslations("timeline.eventType");
  const tImportance = useTranslations("timeline.importance");
  const tForm = useTranslations("timeline.form");
  const typeMeta = eventTypeMeta(event.eventType);
  const importance = importanceMeta(event.importance);

  const metaItems = [
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
      <DialogHeader className="pr-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-icon">
            <UiIcon name={typeMeta.icon} size={13} />
            {tType(event.eventType)}
          </span>
          <span
            className={cn("rounded-full px-2 py-0.5 text-xs font-medium", importance.badgeClass)}
          >
            {tImportance(event.importance)}
          </span>
          <ThreadBadge status={event.threadStatus} />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", markerClass(event.timelineColorKey))}
            />
            {event.timelineName}
          </span>
        </div>
        <DialogTitle>{event.title}</DialogTitle>
        {event.summary === null ? null : <DialogDescription>{event.summary}</DialogDescription>}
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {metaItems.length === 0 ? null : (
          <dl className="grid grid-cols-2 gap-3">
            {metaItems.map((item) => (
              <div className="flex flex-col gap-0.5" key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-sm text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
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
            <p className="rounded-lg bg-secondary/50 p-3 text-sm leading-relaxed whitespace-pre-line text-foreground">
              {event.personalNote}
            </p>
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
      </div>

      <DialogFooter className="sm:justify-between">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            {t("detail.close")}
          </Button>
        </DialogClose>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button onClick={() => onDelete(event)} type="button" variant="destructive">
            <UiIcon name="trash" size={16} />
            {t("detail.delete")}
          </Button>
          <Button onClick={() => onEdit(event)} type="button">
            <UiIcon name="edit" size={16} />
            {t("detail.edit")}
          </Button>
        </div>
      </DialogFooter>
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
