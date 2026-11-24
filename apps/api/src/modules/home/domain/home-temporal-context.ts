import type { WeekStartDay } from "@app/shared";

import { toIsoDate } from "../../../core/iso-date.js";

export type HomeTemporalContext = {
  day: Date;
  timeZone: string;
  today: string;
  weekStartDay: WeekStartDay;
};

export function toHomeTemporalContext(calendar: {
  timeZone: string;
  today: Date;
  weekStartDay: WeekStartDay;
}): HomeTemporalContext {
  return {
    day: calendar.today,
    timeZone: calendar.timeZone,
    today: toIsoDate(calendar.today),
    weekStartDay: calendar.weekStartDay,
  };
}
