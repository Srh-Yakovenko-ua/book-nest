"use client";

import type {
  Nullable,
  TimelineEventView,
  TimelineReadingPosition,
  TimelineView,
} from "@app/shared";
import type { ReactNode, RefObject } from "react";
import type { FieldError as RhfFieldError } from "react-hook-form";

import { TIMELINE_EVENT_TYPES, TIMELINE_IMPORTANCE_LEVELS } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { EventFormMessages, EventFormValues } from "../model/event-form-schema";

import { useCreateTimelineEvent } from "../api/use-create-timeline-event";
import { useTimelineEvent } from "../api/use-timeline-event";
import { useUpdateTimelineEvent } from "../api/use-update-timeline-event";
import { markerStyle } from "../model/color-key";
import {
  buildEventFormSchema,
  EVENT_CHAPTER_MAX,
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_PERSONAL_NOTE_MAX,
  EVENT_STORY_TIME_MAX,
  EVENT_SUMMARY_MAX,
  EVENT_TITLE_MAX,
  eventFormDefaults,
  eventFormValuesToInput,
} from "../model/event-form-schema";
import { eventTypeMeta } from "../model/event-type-meta";
import { importanceMeta } from "../model/importance-meta";
import { EventRelationEditor } from "./event-relation-editor";
import { ResolvedByField } from "./resolved-by-field";
import { TimelineFormSection } from "./timeline-form-section";

const THREAD_CHIP_VALUES = ["none", "open", "resolved"] as const;

type EventFormDialogProps = {
  bookId: string;
  createTimelineId: Nullable<string>;
  event?: TimelineEventView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pagesCount: Nullable<number>;
  readingPosition: Nullable<TimelineReadingPosition>;
  timelines: TimelineView[];
};

type EventFormProps = {
  bookId: string;
  createTimelineId: Nullable<string>;
  dirtyRef: RefObject<boolean>;
  event?: TimelineEventView;
  onRequestClose: () => void;
  onSaved: () => void;
  pagesCount: Nullable<number>;
  readingPosition: Nullable<TimelineReadingPosition>;
  timelines: TimelineView[];
};

type SectionKey = "details" | "place" | "relations" | "thread";

export function EventFormDialog({
  bookId,
  createTimelineId,
  event,
  onOpenChange,
  open,
  pagesCount,
  readingPosition,
  timelines,
}: EventFormDialogProps) {
  const t = useTranslations("timeline.form");
  const tRoot = useTranslations("timeline");
  const isEdit = event !== undefined;
  const dirtyRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestClose() {
    if (dirtyRef.current) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        open={open}
      >
        <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[86vh] sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 sm:px-6">
            <DialogTitle>{isEdit ? tRoot("editEvent") : tRoot("newEvent")}</DialogTitle>
            <DialogDescription>
              {isEdit ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <EventForm
              bookId={bookId}
              createTimelineId={createTimelineId}
              dirtyRef={dirtyRef}
              event={event}
              onRequestClose={requestClose}
              onSaved={() => onOpenChange(false)}
              pagesCount={pagesCount}
              readingPosition={readingPosition}
              timelines={timelines}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dirtyCloseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dirtyCloseDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dirtyCloseCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(clickEvent) => {
                clickEvent.preventDefault();
                setConfirmOpen(false);
                onOpenChange(false);
              }}
              variant="destructive"
            >
              {t("dirtyCloseConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EventForm({
  bookId,
  createTimelineId,
  dirtyRef,
  event,
  onRequestClose,
  onSaved,
  pagesCount,
  readingPosition,
  timelines,
}: EventFormProps) {
  const t = useTranslations("timeline.form");
  const tRoot = useTranslations("timeline");
  const tErrors = useTranslations("timeline.errors");
  const tToast = useTranslations("timeline.toast");
  const tType = useTranslations("timeline.eventType");

  const isEdit = event !== undefined;
  const createEvent = useCreateTimelineEvent();
  const updateEvent = useUpdateTimelineEvent();
  const detailQuery = useTimelineEvent(isEdit ? event.id : null);

  const messages: EventFormMessages = {
    chapterTooLong: tErrors("tooLong", { max: EVENT_CHAPTER_MAX }),
    descriptionTooLong: tErrors("tooLong", { max: EVENT_DESCRIPTION_MAX }),
    locationTooLong: tErrors("tooLong", { max: EVENT_LOCATION_MAX }),
    pageExceedsBook: tErrors("pageExceedsBook", { max: pagesCount ?? 0 }),
    pageNotPositive: tErrors("pageNotPositive"),
    personalNoteTooLong: tErrors("tooLong", { max: EVENT_PERSONAL_NOTE_MAX }),
    storyTimeTooLong: tErrors("tooLong", { max: EVENT_STORY_TIME_MAX }),
    summaryTooLong: tErrors("tooLong", { max: EVENT_SUMMARY_MAX }),
    titleEmpty: tErrors("titleEmpty"),
    titleTooLong: tErrors("tooLong", { max: EVENT_TITLE_MAX }),
  };

  const defaultValues = isEdit
    ? eventFormDefaults({ event, timelineId: event.timelineId })
    : eventFormDefaults({ readingPosition, timelineId: createTimelineId });

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setFocus,
    setValue,
  } = useForm<EventFormValues>({
    defaultValues,
    mode: "onTouched",
    resolver: zodResolver(buildEventFormSchema({ messages, pagesCount })),
  });

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(() => ({
    details:
      defaultValues.location !== "" ||
      defaultValues.description !== "" ||
      defaultValues.personalNote !== "",
    place:
      defaultValues.chapter !== "" ||
      defaultValues.page !== undefined ||
      defaultValues.storyTime !== "",
    relations: false,
    thread: defaultValues.threadStatus !== null,
  }));

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [dirtyRef, isDirty]);

  useEffect(() => {
    setFocus("title");
  }, [setFocus]);

  const [chapter, description, location, page, personalNote, storyTime, summary, threadStatus] =
    useWatch({
      control,
      name: [
        "chapter",
        "description",
        "location",
        "page",
        "personalNote",
        "storyTime",
        "summary",
        "threadStatus",
      ],
    });

  const isPending = createEvent.isPending || updateEvent.isPending;

  function toggleSection(key: SectionKey) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  const placeSummary = joinSummary([
    chapter,
    page === undefined ? "" : tRoot("list.page", { page }),
    storyTime,
  ]);
  const detailsSummary = joinSummary([
    location,
    description === "" ? "" : t("hasDescription"),
    personalNote === "" ? "" : t("hasNote"),
  ]);
  const threadSummary = t(`threadChip.${threadStatus ?? "none"}`);

  const onSubmit = handleSubmit((values, submitEvent) => {
    const input = eventFormValuesToInput(values);
    const addAnother =
      submitEvent?.nativeEvent instanceof SubmitEvent &&
      submitEvent.nativeEvent.submitter?.getAttribute("data-intent") === "again";

    if (event !== undefined) {
      updateEvent.mutate(
        { bookId, eventId: event.id, input },
        {
          onError: () => toast.error(tToast("updateError")),
          onSuccess: () => {
            toast.success(tToast("updated"));
            onSaved();
          },
        },
      );
      return;
    }

    createEvent.mutate(
      { bookId, input },
      {
        onError: () => toast.error(tToast("createError")),
        onSuccess: () => {
          toast.success(tToast("created"));
          if (addAnother) {
            reset(eventFormDefaults({ readingPosition, timelineId: values.timelineId }));
            setOpenSections({
              details: false,
              place: readingPosition?.positionKnown === true,
              relations: false,
              thread: false,
            });
            setFocus("title");
            return;
          }
          onSaved();
        },
      },
    );
  });

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6">
        <TimelineFormSection
          icon="info"
          subtitle={t("sections.basics.subtitle")}
          title={t("sections.basics.title")}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">
              {t("titleLabel")}{" "}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </Label>
            <Input
              aria-describedby={errors.title ? "event-title-error" : undefined}
              aria-invalid={errors.title !== undefined}
              aria-required
              autoComplete="off"
              className="h-10"
              id="event-title"
              maxLength={EVENT_TITLE_MAX}
              placeholder={t("titlePlaceholder")}
              {...register("title")}
            />
            <FieldError error={errors.title} id="event-title-error" />
          </div>

          <FieldWithCounter
            count={summary.length}
            error={errors.summary}
            id="event-summary"
            label={t("summaryLabel")}
            max={EVENT_SUMMARY_MAX}
          >
            <Textarea
              aria-describedby={
                errors.summary
                  ? "event-summary-error event-summary-counter"
                  : "event-summary-counter"
              }
              aria-invalid={errors.summary !== undefined}
              className="min-h-16"
              id="event-summary"
              maxLength={EVENT_SUMMARY_MAX}
              placeholder={t("summaryPlaceholder")}
              rows={3}
              {...register("summary")}
            />
          </FieldWithCounter>

          {isEdit ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{t("timelineLabel")}</span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-field px-3 py-2 text-sm text-foreground">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={markerStyle(event.timelineColorKey)}
                />
                {event.timelineName}
              </span>
              <p className="text-xs text-muted-foreground">{t("timelineEditHint")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-timeline">{t("timelineLabel")}</Label>
              <Controller
                control={control}
                name="timelineId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                    <SelectTrigger
                      className="h-10 w-full data-[size=default]:h-10"
                      id="event-timeline"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timelines.map((timeline) => (
                        <SelectItem key={timeline.id} value={timeline.id}>
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={markerStyle(timeline.colorKey)}
                          />
                          {timeline.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-type">{t("eventTypeLabel")}</Label>
            <Controller
              control={control}
              name="eventType"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-10 w-full data-[size=default]:h-10" id="event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINE_EVENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        <UiIcon name={eventTypeMeta(type).icon} size={14} />
                        {tType(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{t("importanceLabel")}</span>
            <Controller
              control={control}
              name="importance"
              render={({ field }) => (
                <ChipGroup
                  label={t("importanceLabel")}
                  mode="single"
                  onValueChange={(value) => {
                    const next = TIMELINE_IMPORTANCE_LEVELS.find((level) => level === value);
                    if (next === undefined) return;
                    field.onChange(next);
                  }}
                  options={TIMELINE_IMPORTANCE_LEVELS.map((level) => ({
                    label: tRoot(importanceMeta(level).labelKey),
                    value: level,
                  }))}
                  size="sm"
                  value={field.value}
                />
              )}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-field/60 px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor="event-spoiler">{tRoot("spoiler.label")}</Label>
              <p className="text-xs text-muted-foreground">{tRoot("spoiler.hint")}</p>
            </div>
            <Controller
              control={control}
              name="isSpoiler"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  className="mt-1"
                  id="event-spoiler"
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </TimelineFormSection>

        <TimelineFormSection
          collapse={{
            onToggle: () => toggleSection("place"),
            open: openSections.place,
            summary: placeSummary,
          }}
          icon="book"
          subtitle={t("sections.place.subtitle")}
          title={t("sections.place.title")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
              <Label htmlFor="event-chapter">{t("chapterLabel")}</Label>
              <Input
                aria-describedby={errors.chapter ? "event-chapter-error" : undefined}
                aria-invalid={errors.chapter !== undefined}
                autoComplete="off"
                className="h-10"
                id="event-chapter"
                maxLength={EVENT_CHAPTER_MAX}
                placeholder={t("chapterPlaceholder")}
                {...register("chapter")}
              />
              <FieldError error={errors.chapter} id="event-chapter-error" />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="event-page">{t("pageLabel")}</Label>
              <Controller
                control={control}
                name="page"
                render={({ field }) => (
                  <Input
                    aria-describedby={errors.page ? "event-page-error" : undefined}
                    aria-invalid={errors.page !== undefined}
                    autoComplete="off"
                    className="h-10"
                    id="event-page"
                    inputMode="numeric"
                    min={1}
                    onChange={(changeEvent) =>
                      field.onChange(
                        changeEvent.target.value === ""
                          ? undefined
                          : Number(changeEvent.target.value),
                      )
                    }
                    onKeyDown={blockNegativeNumberKeys}
                    onPaste={blockNegativeNumberPaste}
                    placeholder={t("pagePlaceholder")}
                    step={1}
                    type="number"
                    value={field.value ?? ""}
                  />
                )}
              />
              <FieldError error={errors.page} id="event-page-error" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-story-time">{t("storyTimeLabel")}</Label>
            <Input
              aria-describedby={errors.storyTime ? "event-story-time-error" : undefined}
              aria-invalid={errors.storyTime !== undefined}
              autoComplete="off"
              className="h-10"
              id="event-story-time"
              maxLength={EVENT_STORY_TIME_MAX}
              placeholder={t("storyTimePlaceholder")}
              {...register("storyTime")}
            />
            <FieldError error={errors.storyTime} id="event-story-time-error" />
          </div>
        </TimelineFormSection>

        <TimelineFormSection
          collapse={{
            onToggle: () => toggleSection("details"),
            open: openSections.details,
            summary: detailsSummary,
          }}
          icon="file-text"
          subtitle={t("sections.details.subtitle")}
          title={t("sections.details.title")}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-location">{t("locationLabel")}</Label>
            <Input
              aria-describedby={errors.location ? "event-location-error" : undefined}
              aria-invalid={errors.location !== undefined}
              autoComplete="off"
              className="h-10"
              id="event-location"
              maxLength={EVENT_LOCATION_MAX}
              placeholder={t("locationPlaceholder")}
              {...register("location")}
            />
            <FieldError error={errors.location} id="event-location-error" />
          </div>

          <FieldWithCounter
            count={description.length}
            error={errors.description}
            id="event-description"
            label={t("descriptionLabel")}
            max={EVENT_DESCRIPTION_MAX}
          >
            <Textarea
              aria-describedby={
                errors.description
                  ? "event-description-error event-description-counter"
                  : "event-description-counter"
              }
              aria-invalid={errors.description !== undefined}
              className="min-h-28"
              id="event-description"
              maxLength={EVENT_DESCRIPTION_MAX}
              placeholder={t("descriptionPlaceholder")}
              rows={5}
              {...register("description")}
            />
          </FieldWithCounter>

          <FieldWithCounter
            count={personalNote.length}
            error={errors.personalNote}
            id="event-personal-note"
            label={t("personalNoteLabel")}
            max={EVENT_PERSONAL_NOTE_MAX}
          >
            <Textarea
              aria-describedby={
                errors.personalNote
                  ? "event-personal-note-error event-personal-note-counter"
                  : "event-personal-note-counter"
              }
              aria-invalid={errors.personalNote !== undefined}
              className="min-h-20"
              id="event-personal-note"
              maxLength={EVENT_PERSONAL_NOTE_MAX}
              placeholder={t("personalNotePlaceholder")}
              rows={4}
              {...register("personalNote")}
            />
          </FieldWithCounter>
        </TimelineFormSection>

        <TimelineFormSection
          collapse={{
            onToggle: () => toggleSection("thread"),
            open: openSections.thread,
            summary: threadSummary,
          }}
          icon="help-circle"
          subtitle={t("sections.thread.subtitle")}
          title={t("sections.thread.title")}
        >
          <Controller
            control={control}
            name="threadStatus"
            render={({ field }) => (
              <ChipGroup
                label={t("sections.thread.title")}
                mode="single"
                onValueChange={(value) => {
                  const next = value === "open" || value === "resolved" ? value : null;
                  field.onChange(next);
                  if (next !== "resolved") {
                    setValue("resolvedByEventId", null, { shouldDirty: true });
                  }
                }}
                options={THREAD_CHIP_VALUES.map((chip) => ({
                  label: t(`threadChip.${chip}`),
                  value: chip,
                }))}
                size="sm"
                value={field.value ?? "none"}
              />
            )}
          />

          {threadStatus === "resolved" ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                {tRoot("thread.resolvedBy")}
              </span>
              <Controller
                control={control}
                name="resolvedByEventId"
                render={({ field }) => (
                  <ResolvedByField
                    bookId={bookId}
                    initialPreview={detailQuery.data?.resolvedBy ?? null}
                    onChange={field.onChange}
                    selfEventId={event?.id ?? null}
                    value={field.value}
                  />
                )}
              />
            </div>
          ) : null}
        </TimelineFormSection>

        {isEdit ? (
          <TimelineFormSection
            collapse={{
              onToggle: () => toggleSection("relations"),
              open: openSections.relations,
            }}
            icon="link"
            subtitle={t("sections.relations.subtitle")}
            title={t("sections.relations.title")}
          >
            <EventRelationEditor bookId={bookId} eventId={event.id} />
          </TimelineFormSection>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        <Button disabled={isPending} onClick={onRequestClose} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          {isEdit ? null : (
            <Button data-intent="again" disabled={isPending} type="submit" variant="outline">
              {t("saveAndAddAnother")}
            </Button>
          )}
          <Button data-intent="close" disabled={isPending} loading={isPending} type="submit">
            {isEdit ? t("saveChanges") : t("saveEvent")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function FieldWithCounter({
  children,
  count,
  error,
  id,
  label,
  max,
}: {
  children: ReactNode;
  count: number;
  error?: RhfFieldError;
  id: string;
  label: string;
  max: number;
}) {
  const t = useTranslations("timeline.form");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <div className="flex items-center justify-between gap-2">
        <FieldError error={error} id={`${id}-error`} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" id={`${id}-counter`}>
          {t("charCounter", { count, max })}
        </span>
      </div>
    </div>
  );
}

function joinSummary(parts: readonly string[]): string | undefined {
  const filled = parts.filter((part) => part !== "");
  return filled.length === 0 ? undefined : filled.join(" · ");
}
