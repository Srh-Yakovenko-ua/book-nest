import type { InterfaceLanguage, WeekStartDay } from "@app/shared";

import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { weekdayPreview } from "./weekday-preview";

const NOW = {
  sunday: parseISO("2026-01-18T12:00:00Z"),
  wednesday: parseISO("2026-01-14T12:00:00Z"),
} as const;

const SHORT_NAMES: readonly {
  language: InterfaceLanguage;
  short: readonly string[];
  weekStartDay: WeekStartDay;
}[] = [
  { language: "uk", short: ["пн", "вт", "ср", "чт", "пт", "сб", "нд"], weekStartDay: "monday" },
  { language: "uk", short: ["нд", "пн", "вт", "ср", "чт", "пт", "сб"], weekStartDay: "sunday" },
  { language: "en", short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], weekStartDay: "sunday" },
  { language: "en", short: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], weekStartDay: "monday" },
];

describe.each(["wednesday", "sunday"] as const)("weekdayPreview when now is a %s", (today) => {
  it.each(SHORT_NAMES)(
    "lists the seven $language short names starting from $weekStartDay",
    ({ language, short, weekStartDay }) => {
      const preview = weekdayPreview({ language, now: NOW[today], weekStartDay });

      expect(preview.map((day) => day.short)).toEqual(short);
    },
  );

  it("starts the Ukrainian long names with понеділок for a Monday start", () => {
    const preview = weekdayPreview({ language: "uk", now: NOW[today], weekStartDay: "monday" });

    expect(preview.map((day) => day.long)[0]).toBe("понеділок");
  });
});
