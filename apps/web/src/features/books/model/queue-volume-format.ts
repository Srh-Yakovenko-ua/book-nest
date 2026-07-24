import type { ReadingQueueVolumeSummaryView } from "@app/shared";

const DAYS_UNIT_CEILING = 14;
const WEEKS_UNIT_CEILING = 60;
const MONTHS_UNIT_CEILING = 365;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

export type QueueEstimate =
  | { kind: "overYear" }
  | { kind: "range"; max: number; min: number; unit: QueueEstimateUnit }
  | { kind: "single"; unit: QueueEstimateUnit; value: number };

export type QueueEstimateUnit = "days" | "months" | "weeks";

export type QueueVolumeForecast =
  | { days: number; kind: "countdown" }
  | { estimate: QueueEstimate; kind: "estimate" }
  | { kind: "hidden" }
  | { kind: "note"; note: QueueVolumeNote };

export type QueueVolumeNote = "noVolumeData" | "staleActivity" | "updateProgress";

export function toQueueEstimate({
  daysMax,
  daysMin,
}: {
  daysMax: number;
  daysMin: number;
}): QueueEstimate {
  if (daysMax >= MONTHS_UNIT_CEILING) return { kind: "overYear" };

  const unit = pickUnit(daysMax);
  const divisor = divisorOf(unit);
  const min = Math.max(1, Math.round(daysMin / divisor));
  const max = Math.max(min, Math.round(daysMax / divisor));

  if (min === max) return { kind: "single", unit, value: min };
  return { kind: "range", max, min, unit };
}

export function toQueueVolumeForecast(
  estimate: ReadingQueueVolumeSummaryView["estimate"],
): QueueVolumeForecast {
  const { daysMax, daysMin, daysUntilForecast, reasonUnavailable } = estimate;

  if (reasonUnavailable === null) {
    if (daysMax === null || daysMin === null) return { kind: "hidden" };
    return { estimate: toQueueEstimate({ daysMax, daysMin }), kind: "estimate" };
  }

  switch (reasonUnavailable) {
    case "empty_queue":
    case "insufficient_coverage":
      return { kind: "hidden" };
    case "insufficient_history":
      if (daysUntilForecast === null) return { kind: "note", note: "updateProgress" };
      return { days: daysUntilForecast, kind: "countdown" };
    case "no_volume_data":
      return { kind: "note", note: "noVolumeData" };
    case "stale_activity":
    case "zero_pace":
      return { kind: "note", note: "staleActivity" };
    default:
      return assertNever(reasonUnavailable);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected reading queue volume reason: ${String(value)}`);
}

function divisorOf(unit: QueueEstimateUnit): number {
  if (unit === "days") return 1;
  if (unit === "weeks") return DAYS_IN_WEEK;
  return DAYS_IN_MONTH;
}

function pickUnit(daysMax: number): QueueEstimateUnit {
  if (daysMax < DAYS_UNIT_CEILING) return "days";
  if (daysMax < WEEKS_UNIT_CEILING) return "weeks";
  return "months";
}
