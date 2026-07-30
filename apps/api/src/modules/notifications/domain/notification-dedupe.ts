import { formatInTimeZone } from "date-fns-tz";

const DEDUPE_HOUR_FORMAT = "yyyy-MM-dd'T'HH";
const DEDUPE_TIME_ZONE = "UTC";

export function buildTestDedupeKey({
  requestedAt,
  userId,
}: {
  requestedAt: Date;
  userId: string;
}): string {
  return `test:${userId}:${formatInTimeZone(requestedAt, DEDUPE_TIME_ZONE, DEDUPE_HOUR_FORMAT)}`;
}
