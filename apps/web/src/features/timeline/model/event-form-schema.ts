import type {
  CreateTimelineEventInput,
  Nullable,
  TimelineEventView,
  TimelineReadingPosition,
} from "@app/shared";

import {
  TIMELINE_EVENT_PAGE_MAX,
  TimelineEventTypeSchema,
  TimelineImportanceSchema,
  TimelineThreadStatusSchema,
} from "@app/shared";
import { z } from "zod";

export const EVENT_TITLE_MAX = 150;
export const EVENT_SUMMARY_MAX = 300;
export const EVENT_DESCRIPTION_MAX = 5000;
export const EVENT_CHAPTER_MAX = 100;
export const EVENT_LOCATION_MAX = 200;
export const EVENT_STORY_TIME_MAX = 100;
export const EVENT_PERSONAL_NOTE_MAX = 3000;

export type EventFormMessages = {
  chapterTooLong: string;
  descriptionTooLong: string;
  locationTooLong: string;
  pageExceedsBook: string;
  pageNotPositive: string;
  personalNoteTooLong: string;
  storyTimeTooLong: string;
  summaryTooLong: string;
  titleEmpty: string;
  titleTooLong: string;
};

export type EventFormValues = z.infer<ReturnType<typeof buildEventFormSchema>>;

type BuildEventFormSchemaOptions = {
  messages: EventFormMessages;
  pagesCount: Nullable<number>;
};

type EventFormDefaultsOptions = {
  event?: TimelineEventView;
  readingPosition?: Nullable<TimelineReadingPosition>;
  timelineId: Nullable<string>;
};

export function buildEventFormSchema({ messages, pagesCount }: BuildEventFormSchemaOptions) {
  const pageCeiling = pagesCount === null || pagesCount < 1 ? TIMELINE_EVENT_PAGE_MAX : pagesCount;
  const pageMessage = pagesCount === null ? messages.pageNotPositive : messages.pageExceedsBook;

  return z.object({
    chapter: z.string().trim().max(EVENT_CHAPTER_MAX, { error: messages.chapterTooLong }),
    description: z
      .string()
      .trim()
      .max(EVENT_DESCRIPTION_MAX, { error: messages.descriptionTooLong }),
    eventType: TimelineEventTypeSchema,
    importance: TimelineImportanceSchema,
    location: z.string().trim().max(EVENT_LOCATION_MAX, { error: messages.locationTooLong }),
    page: z
      .number()
      .int()
      .positive({ error: messages.pageNotPositive })
      .max(pageCeiling, { error: pageMessage })
      .optional(),
    personalNote: z
      .string()
      .trim()
      .max(EVENT_PERSONAL_NOTE_MAX, { error: messages.personalNoteTooLong }),
    resolvedByEventId: z.string().nullable(),
    storyTime: z.string().trim().max(EVENT_STORY_TIME_MAX, { error: messages.storyTimeTooLong }),
    summary: z.string().trim().max(EVENT_SUMMARY_MAX, { error: messages.summaryTooLong }),
    threadStatus: TimelineThreadStatusSchema.nullable(),
    timelineId: z.string().nullable(),
    title: z
      .string()
      .trim()
      .min(1, { error: messages.titleEmpty })
      .max(EVENT_TITLE_MAX, { error: messages.titleTooLong }),
  });
}

export function eventFormDefaults({
  event,
  readingPosition,
  timelineId,
}: EventFormDefaultsOptions): EventFormValues {
  if (event !== undefined) {
    return {
      chapter: event.chapter ?? "",
      description: event.description ?? "",
      eventType: event.eventType,
      importance: event.importance,
      location: event.location ?? "",
      page: event.pageNumber ?? undefined,
      personalNote: event.personalNote ?? "",
      resolvedByEventId: event.resolvedByEventId,
      storyTime: event.storyTime ?? "",
      summary: event.summary ?? "",
      threadStatus: event.threadStatus,
      timelineId: event.timelineId,
      title: event.title,
    };
  }

  const suggestedPage =
    readingPosition?.positionKnown === true
      ? (readingPosition.currentPage ?? undefined)
      : undefined;

  return {
    chapter: "",
    description: "",
    eventType: "main",
    importance: "medium",
    location: "",
    page: suggestedPage,
    personalNote: "",
    resolvedByEventId: null,
    storyTime: "",
    summary: "",
    threadStatus: null,
    timelineId,
    title: "",
  };
}

export function eventFormValuesToInput(values: EventFormValues): CreateTimelineEventInput {
  return {
    chapter: emptyToNull(values.chapter),
    description: emptyToNull(values.description),
    eventType: values.eventType,
    importance: values.importance,
    location: emptyToNull(values.location),
    pageNumber: values.page ?? null,
    personalNote: emptyToNull(values.personalNote),
    resolvedByEventId: values.threadStatus === "resolved" ? values.resolvedByEventId : null,
    storyTime: emptyToNull(values.storyTime),
    summary: emptyToNull(values.summary),
    threadStatus: values.threadStatus,
    timelineId: values.timelineId ?? undefined,
    title: values.title.trim(),
  };
}

function emptyToNull(value: string): Nullable<string> {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
