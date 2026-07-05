import { z } from "zod";

import { LIST_PAGE_SIZE_MAX, noHtmlTags } from "./common.js";

export const NoHtmlString = z.string().refine(noHtmlTags, "HTML tags are not allowed");

const TIMEZONE_SKEW_TOLERANCE_MS = 24 * 60 * 60 * 1000;

const isNotInFuture = (value: string): boolean => {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const latestAcceptable = todayUtc.getTime() + TIMEZONE_SKEW_TOLERANCE_MS;
  return new Date(`${value}T00:00:00.000Z`).getTime() <= latestAcceptable;
};

export const notInFutureDate = (message: string) => z.iso.date().refine(isNotInFuture, message);

export const HTTPS_PROTOCOL = /^https$/;

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
