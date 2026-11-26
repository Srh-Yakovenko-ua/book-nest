import type { InterfaceLanguage } from "@app/shared";

import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { timezoneOptions } from "./timezone-options";

const DATES = {
  summer: parseISO("2026-07-15T12:00:00Z"),
  winter: parseISO("2026-01-15T12:00:00Z"),
} as const;

const KYIV_LABELS: readonly {
  label: string;
  language: InterfaceLanguage;
  season: keyof typeof DATES;
}[] = [
  { label: "Київ · UTC+02:00", language: "uk", season: "winter" },
  { label: "Kyiv · UTC+02:00", language: "en", season: "winter" },
  { label: "Київ · UTC+03:00", language: "uk", season: "summer" },
  { label: "Kyiv · UTC+03:00", language: "en", season: "summer" },
];

const STORED_ZONE_CASES: readonly {
  listed: readonly string[];
  stored: string;
  values: readonly string[];
}[] = [
  {
    listed: ["Europe/Warsaw", "Europe/Kiev", "Africa/Abidjan"],
    stored: "Europe/Kyiv",
    values: ["Europe/Kyiv", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "Europe/Kyiv", "Africa/Abidjan"],
    stored: "Europe/Kyiv",
    values: ["Europe/Kyiv", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "Africa/Abidjan"],
    stored: "Europe/Kyiv",
    values: ["Europe/Kyiv", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "Europe/Kiev", "Africa/Abidjan"],
    stored: "Europe/Kiev",
    values: ["Europe/Kyiv", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "Europe/Kyiv", "Africa/Abidjan"],
    stored: "Europe/Kiev",
    values: ["Europe/Kyiv", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "Africa/Abidjan"],
    stored: "Europe/Kiev",
    values: ["Europe/Kyiv", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "UTC", "Africa/Abidjan"],
    stored: "UTC",
    values: ["UTC", "Africa/Abidjan", "Europe/Warsaw"],
  },
  {
    listed: ["Europe/Warsaw", "Africa/Abidjan"],
    stored: "UTC",
    values: ["UTC", "Africa/Abidjan", "Europe/Warsaw"],
  },
];

const CITY_ORDER: readonly { cities: readonly string[]; language: InterfaceLanguage }[] = [
  { cities: ["Київ", "Абіджан", "Берлін", "Варшава", "Лондон", "Нью-Йорк"], language: "uk" },
  { cities: ["Kyiv", "Abidjan", "Berlin", "London", "New York", "Warsaw"], language: "en" },
];

const UNNAMED_ZONES = [
  { label: "UTC · UTC+00:00", zone: "UTC" },
  { label: "Etc/GMT-3 · UTC+03:00", zone: "Etc/GMT-3" },
] as const;

describe("timezoneOptions", () => {
  it.each(KYIV_LABELS)(
    "labels Europe/Kyiv as $label in $language in $season",
    ({ label, language, season }) => {
      const [stored] = timezoneOptions({
        language,
        now: DATES[season],
        storedZone: "Europe/Kyiv",
        supportedZones: [],
      });

      expect(stored.label).toBe(label);
    },
  );

  it.each(STORED_ZONE_CASES)(
    "lists the stored $stored first and once when the runtime lists $listed",
    ({ listed, stored, values }) => {
      const options = timezoneOptions({
        language: "en",
        now: DATES.winter,
        storedZone: stored,
        supportedZones: listed,
      });

      expect(options.map((option) => option.value)).toEqual(values);
    },
  );

  it("shows a stored legacy Europe/Kiev under its current id and Ukrainian city name", () => {
    const [stored] = timezoneOptions({
      language: "uk",
      now: DATES.winter,
      storedZone: "Europe/Kiev",
      supportedZones: ["Europe/Kiev"],
    });

    expect(stored).toMatchObject({ city: "Київ", value: "Europe/Kyiv" });
  });

  it.each(CITY_ORDER)(
    "orders the other zones alphabetically by the $language city name",
    ({ cities, language }) => {
      const options = timezoneOptions({
        language,
        now: DATES.winter,
        storedZone: "Europe/Kyiv",
        supportedZones: [
          "Europe/Warsaw",
          "America/New_York",
          "Europe/London",
          "Africa/Abidjan",
          "Europe/Berlin",
        ],
      });

      expect(options.map((option) => option.city)).toEqual(cities);
    },
  );

  it.each(UNNAMED_ZONES)(
    "falls back to the IANA id $zone as the city of a zone with no localized name",
    ({ label, zone }) => {
      const [stored] = timezoneOptions({
        language: "uk",
        now: DATES.winter,
        storedZone: zone,
        supportedZones: [],
      });

      expect(stored).toMatchObject({ city: zone, label, value: zone });
    },
  );
});
