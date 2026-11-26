import type { InterfaceLanguage } from "@app/shared";

import { InterfaceLanguageSchema } from "@app/shared";
import { formatInTimeZone } from "date-fns-tz";

import { currentTimezoneName, legacyTimezoneNames } from "./current-timezone-names";
import { TIMEZONE_CITY_NAMES } from "./timezone-city-names";

export type TimezoneOption = {
  city: string;
  label: string;
  offset: string;
  searchTerms: readonly string[];
  value: string;
};

type ZoneWithCityName = keyof typeof TIMEZONE_CITY_NAMES;

const TIMEZONE_LABEL = {
  offsetFormat: "xxx",
  separator: " · ",
  utcPrefix: "UTC",
} as const;

export function timezoneOption({
  language,
  now,
  zone,
}: {
  language: InterfaceLanguage;
  now: Date;
  zone: string;
}): TimezoneOption {
  const value = currentTimezoneName(zone);
  const city = cityName({ language, value });
  const offset = formatInTimeZone(now, zone, TIMEZONE_LABEL.offsetFormat);

  return {
    city,
    label: `${city}${TIMEZONE_LABEL.separator}${TIMEZONE_LABEL.utcPrefix}${offset}`,
    offset,
    searchTerms: zoneSearchTerms(value),
    value,
  };
}

export function timezoneOptions({
  language,
  now,
  storedZone,
  supportedZones = Intl.supportedValuesOf("timeZone"),
}: {
  language: InterfaceLanguage;
  now: Date;
  storedZone: string;
  supportedZones?: readonly string[];
}): readonly [TimezoneOption, ...TimezoneOption[]] {
  const storedValue = currentTimezoneName(storedZone);
  const storedRuntimeZone = runtimeTimezoneName(storedZone);
  const isStoredZone = (zone: string): boolean =>
    currentTimezoneName(zone) === storedValue || runtimeTimezoneName(zone) === storedRuntimeZone;

  const otherZonesByValue = new Map(
    supportedZones
      .filter((zone) => !isStoredZone(zone))
      .map((zone): [string, string] => [currentTimezoneName(zone), zone]),
  );
  const collator = new Intl.Collator(language);
  const otherOptions = [...otherZonesByValue.values()]
    .map((zone) => timezoneOption({ language, now, zone }))
    .sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.value, b.value));

  const storedOption = timezoneOption({ language, now, zone: storedZone });
  const storedSearchTerms = new Set([
    ...storedOption.searchTerms,
    ...zoneSearchTerms(currentTimezoneName(storedRuntimeZone)),
  ]);

  return [{ ...storedOption, searchTerms: [...storedSearchTerms] }, ...otherOptions];
}

function cityName({ language, value }: { language: InterfaceLanguage; value: string }): string {
  return hasCityName(value) ? TIMEZONE_CITY_NAMES[value][language] : value;
}

function citySegment(zone: string): string {
  return zone.slice(zone.lastIndexOf("/") + 1);
}

function hasCityName(zone: string): zone is ZoneWithCityName {
  return Object.hasOwn(TIMEZONE_CITY_NAMES, zone);
}

function runtimeTimezoneName(zone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
}

function zoneSearchTerms(value: string): readonly string[] {
  const ids = [value, ...legacyTimezoneNames(value)];
  const cityNames = InterfaceLanguageSchema.options.map((language) =>
    cityName({ language, value }),
  );

  return [...new Set([...cityNames, ...ids, ...ids.map(citySegment)])];
}
