"use client";

import type {
  Nullable,
  TimelineEventView,
  TimelineReadingPosition,
  TimelineThreadStatus,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import type { EventFormMessages, EventFormValues } from "../model/event-form-schema";

import { useCreateTimelineEvent } from "../api/use-create-timeline-event";
import { useTimelineEvent } from "../api/use-timeline-event";
import { useUpdateTimelineEvent } from "../api/use-update-timeline-event";
import { markerClass } from "../model/color-key";
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
import { EventRelationEditor } from "./event-relation-editor";
import { ResolvedByField } from "./resolved-by-field";

const THREAD_NONE_VALUE = "none";

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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
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
  const tErrors = useTranslations("timeline.errors");
  const tToast = useTranslations("timeline.toast");
  const tType = useTranslations("timeline.eventType");
  const tImportance = useTranslations("timeline.importance");
  const tThread = useTranslations("timeline.thread");

  const isEdit = event !== undefined;
  const createEvent = useCreateTimelineEvent();
  const updateEvent = useUpdateTimelineEvent();
  const detailQuery = useTimelineEvent(isEdit ? event.id : null);

  const [expanded, setExpanded] = useState(isEdit);

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

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setFocus,
  } = useForm<EventFormValues>({
    defaultValues: isEdit
      ? eventFormDefaults({ event, timelineId: event.timelineId })
      : eventFormDefaults({ readingPosition, timelineId: createTimelineId }),
    mode: "onTouched",
    resolver: zodResolver(buildEventFormSchema({ messages, pagesCount })),
  });

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [dirtyRef, isDirty]);

  useEffect(() => {
    setFocus("title");
  }, [setFocus]);

  const summary = useWatch({ control, name: "summary" });
  const description = useWatch({ control, name: "description" });
  const storyTime = useWatch({ control, name: "storyTime" });
  const personalNote = useWatch({ control, name: "personalNote" });
  const threadStatus = useWatch({ control, name: "threadStatus" });

  const isPending = createEvent.isPending || updateEvent.isPending;

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
            setFocus("title");
            return;
          }
          onSaved();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-0.5 py-0.5">
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
              errors.summary ? "event-summary-error event-summary-counter" : "event-summary-counter"
            }
            aria-invalid={errors.summary !== undefined}
            className="min-h-16"
            id="event-summary"
            maxLength={EVENT_SUMMARY_MAX}
            placeholder={t("summaryPlaceholder")}
            {...register("summary")}
          />
        </FieldWithCounter>

        <div className="flex flex-col gap-2">
          <Label htmlFor="event-timeline">
            {t("timelineLabel")}{" "}
            <span aria-hidden className="text-destructive">
              *
            </span>
          </Label>
          <Controller
            control={control}
            name="timelineId"
            render={({ field }) => (
              <Select
                disabled={isEdit}
                onValueChange={field.onChange}
                value={field.value ?? undefined}
              >
                <SelectTrigger className="h-10 w-full data-[size=default]:h-10" id="event-timeline">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timelines.map((timeline) => (
                    <SelectItem key={timeline.id} value={timeline.id}>
                      <span
                        aria-hidden
                        className={cn("size-2 rounded-full", markerClass(timeline.colorKey))}
                      />
                      {timeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {isEdit ? <p className="text-xs text-muted-foreground">{t("timelineEditHint")}</p> : null}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
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

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="event-importance">{t("importanceLabel")}</Label>
            <Controller
              control={control}
              name="importance"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className="h-10 w-full data-[size=default]:h-10"
                    id="event-importance"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINE_IMPORTANCE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {tImportance(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <Button
          className="self-start"
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <UiIcon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
          {expanded ? t("fewerFields") : t("moreFields")}
        </Button>

        {expanded ? (
          <>
            <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
              <legend className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("placeInBook")}
              </legend>

              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
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

                <div className="flex min-w-0 flex-col gap-2 sm:w-40">
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

              <FieldWithCounter
                count={storyTime.length}
                error={errors.storyTime}
                id="event-story-time"
                label={t("storyTimeLabel")}
                max={EVENT_STORY_TIME_MAX}
              >
                <Input
                  aria-describedby={
                    errors.storyTime
                      ? "event-story-time-error event-story-time-counter"
                      : "event-story-time-counter"
                  }
                  aria-invalid={errors.storyTime !== undefined}
                  autoComplete="off"
                  className="h-10"
                  id="event-story-time"
                  maxLength={EVENT_STORY_TIME_MAX}
                  placeholder={t("storyTimePlaceholder")}
                  {...register("storyTime")}
                />
              </FieldWithCounter>
            </fieldset>

            <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
              <legend className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("additionalData")}
              </legend>

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
                  className="min-h-24"
                  id="event-description"
                  maxLength={EVENT_DESCRIPTION_MAX}
                  placeholder={t("descriptionPlaceholder")}
                  {...register("description")}
                />
              </FieldWithCounter>

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
                  {...register("personalNote")}
                />
              </FieldWithCounter>

              <div className="flex flex-col gap-2">
                <Label htmlFor="event-thread-status">{t("threadStatusLabel")}</Label>
                <Controller
                  control={control}
                  name="threadStatus"
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) =>
                        field.onChange(
                          value === THREAD_NONE_VALUE ? null : (value as TimelineThreadStatus),
                        )
                      }
                      value={field.value ?? THREAD_NONE_VALUE}
                    >
                      <SelectTrigger
                        className="h-10 w-full data-[size=default]:h-10"
                        id="event-thread-status"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={THREAD_NONE_VALUE}>{t("threadNone")}</SelectItem>
                        <SelectItem value="open">{tThread("open")}</SelectItem>
                        <SelectItem value="resolved">{tThread("resolved")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {threadStatus === "resolved" ? (
                <div className="flex flex-col gap-2">
                  <Label>{tThread("resolvedBy")}</Label>
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

              {isEdit ? (
                <div className="flex flex-col gap-2">
                  <Label>{t("relationsLabel")}</Label>
                  <p className="text-xs text-muted-foreground">{t("relationsHint")}</p>
                  <EventRelationEditor bookId={bookId} eventId={event.id} />
                </div>
              ) : null}
            </fieldset>
          </>
        ) : null}
      </div>

      <DialogFooter className="sm:justify-between">
        <Button disabled={isPending} onClick={onRequestClose} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {isEdit ? null : (
            <Button data-intent="again" disabled={isPending} type="submit" variant="outline">
              {t("saveAndAddAnother")}
            </Button>
          )}
          <Button data-intent="close" disabled={isPending} loading={isPending} type="submit">
            {isPending ? t("saving") : t("saveEvent")}
          </Button>
        </div>
      </DialogFooter>
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
