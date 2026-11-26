import type { InterfaceLanguage, WeekStartDay } from "@app/shared";

import { WEEK_STARTS_ON } from "@app/shared";
import { addDays, format, startOfWeek } from "date-fns";
import { daysInWeek } from "date-fns/constants";

import { dateFnsLocale } from "@/lib/format";

type WeekdayName = {
  long: string;
  short: string;
};

const WEEKDAY_FORMAT = {
  long: "EEEE",
  short: "EEEEEE",
} as const;

export function weekdayPreview({
  language,
  now,
  weekStartDay,
}: {
  language: InterfaceLanguage;
  now: Date;
  weekStartDay: WeekStartDay;
}): readonly WeekdayName[] {
  const locale = dateFnsLocale(language);
  const firstDay = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON[weekStartDay] });

  return Array.from({ length: daysInWeek }, (_unused, index) => {
    const day = addDays(firstDay, index);
    return {
      long: format(day, WEEKDAY_FORMAT.long, { locale }),
      short: format(day, WEEKDAY_FORMAT.short, { locale }),
    };
  });
}
