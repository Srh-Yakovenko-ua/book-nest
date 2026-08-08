import { addDays, isAfter } from "date-fns";
import { z } from "zod";

import { LIST_PAGE_SIZE_MAX, noHtmlTags } from "./common.js";

export const NoHtmlString = z.string().refine(noHtmlTags, "HTML tags are not allowed");

export const BOOK_RATING = {
  max: 10,
  min: 0.5,
  step: 0.5,
} as const;

export const ratingBound = () =>
  z.coerce.number().min(BOOK_RATING.min).max(BOOK_RATING.max).multipleOf(BOOK_RATING.step);

const UTC_DAY = {
  isoDateLength: 10,
  skewToleranceDays: 1,
  startOf: (date: Date): Date =>
    new Date(`${date.toISOString().slice(0, UTC_DAY.isoDateLength)}T00:00:00.000Z`),
} as const;

const isNotInFuture = (value: string): boolean => {
  const latestAcceptable = addDays(UTC_DAY.startOf(new Date()), UTC_DAY.skewToleranceDays);
  return !isAfter(new Date(`${value}T00:00:00.000Z`), latestAcceptable);
};

export const notInFutureDate = (message: string) => z.iso.date().refine(isNotInFuture, message);

export const HTTPS_PROTOCOL = /^https$/;

export const HTTP_OR_HTTPS_PROTOCOL = /^https?$/;

export const boundedUrlSchema = (options: {
  maxLength: number;
  protocol: RegExp;
  urlError: string;
}) =>
  z
    .string()
    .trim()
    .max(options.maxLength, `URL must be at most ${options.maxLength} characters long`)
    .refine(noHtmlTags, "HTML tags are not allowed")
    .pipe(z.url({ error: options.urlError, protocol: options.protocol }));

export const RECENT_USED_LIMIT_DEFAULT = 8;
export const RECENT_USED_LIMIT_MAX = 20;

const coerceQueryStringArray = (value: unknown): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const entries = Array.isArray(value) ? value : [value];
  const parts = entries.flatMap((entry) => (typeof entry === "string" ? entry.split(",") : entry));
  const cleaned = parts
    .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
    .filter((entry) => entry !== "");
  return cleaned.length === 0 ? undefined : cleaned;
};

export const queryStringArray = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess(coerceQueryStringArray, z.array(schema).max(LIST_PAGE_SIZE_MAX).optional());
