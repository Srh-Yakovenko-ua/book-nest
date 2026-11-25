import type { InterfaceLanguage } from "@app/shared";

import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { timezoneOptions } from "./timezone-options";
import { rankTimezones } from "./timezone-search";

const NOW = parseISO("2026-01-15T12:00:00Z");

const RUNTIME_OPTIONS = {
  en: timezoneOptions({ language: "en", now: NOW, storedZone: "Asia/Tokyo" }),
  uk: timezoneOptions({ language: "uk", now: NOW, storedZone: "Asia/Tokyo" }),
} satisfies Record<InterfaceLanguage, unknown>;

const LANGUAGES = ["uk", "en"] as const satisfies readonly InterfaceLanguage[];

const QUERIES = {
  blank: ["", "   "],
  hyphenated: [
    { query: "нью йорк", zone: "America/New_York" },
    { query: "аддис абеба", zone: "Africa/Addis_Ababa" },
  ],
  kyiv: ["Київ", "Kyiv", "Kiev", "Europe/Kyiv", "київ"],
  newYork: ["new york", "New_York"],
  warsaw: ["Варшава", "Warsaw"],
} as const;

function rankedValues({
  language,
  query,
}: {
  language: InterfaceLanguage;
  query: string;
}): readonly string[] {
  const options = RUNTIME_OPTIONS[language];
  return rankTimezones({ options, query }).map((option) => option.value);
}

function smallListValues({
  query,
  storedZone,
  supportedZones,
}: {
  query: string;
  storedZone: string;
  supportedZones: readonly string[];
}): readonly string[] {
  const options = timezoneOptions({ language: "en", now: NOW, storedZone, supportedZones });
  return rankTimezones({ options, query }).map((option) => option.value);
}

describe.each(LANGUAGES)("rankTimezones with the %s interface", (language) => {
  it.each(QUERIES.kyiv)("finds Europe/Kyiv first for %s", (query) => {
    expect(rankedValues({ language, query })[0]).toBe("Europe/Kyiv");
  });

  it.each(QUERIES.warsaw)("finds Europe/Warsaw first by its city name %s", (query) => {
    expect(rankedValues({ language, query })[0]).toBe("Europe/Warsaw");
  });

  it.each(QUERIES.newYork)(
    "treats underscore and space alike: %s finds America/New_York first",
    (query) => {
      expect(rankedValues({ language, query })[0]).toBe("America/New_York");
    },
  );

  it.each(QUERIES.hyphenated)(
    "treats a hyphen like a space: $query finds $zone first",
    ({ query, zone }) => {
      expect(rankedValues({ language, query })[0]).toBe(zone);
    },
  );

  it.each(QUERIES.blank)("returns the full list for the blank query %j", (query) => {
    const options = RUNTIME_OPTIONS[language];

    expect(rankTimezones({ options, query })).toEqual(options);
  });

  it("returns nothing when no zone matches", () => {
    expect(rankedValues({ language, query: "zzzz" })).toEqual([]);
  });
});

describe("rankTimezones match order", () => {
  it("puts an exact match before a starts-with match that comes first in the options", () => {
    const ranked = smallListValues({
      query: "bahia",
      storedZone: "America/Bahia_Banderas",
      supportedZones: ["America/Bahia", "Asia/Tokyo"],
    });

    expect(ranked).toEqual(["America/Bahia", "America/Bahia_Banderas"]);
  });

  it("puts a starts-with match before a contains match that comes first in the options", () => {
    const ranked = smallListValues({
      query: "vost",
      storedZone: "Asia/Vladivostok",
      supportedZones: ["Antarctica/Vostok", "Asia/Tokyo"],
    });

    expect(ranked).toEqual(["Antarctica/Vostok", "Asia/Vladivostok"]);
  });

  it("keeps the options order inside one match group", () => {
    const ranked = smallListValues({
      query: "mari",
      storedZone: "America/Marigot",
      supportedZones: [
        "Europe/San_Marino",
        "America/Paramaribo",
        "Europe/Berlin",
        "Europe/Mariehamn",
        "Asia/Tokyo",
      ],
    });

    expect(ranked).toEqual([
      "America/Marigot",
      "Europe/Mariehamn",
      "America/Paramaribo",
      "Europe/San_Marino",
    ]);
  });
});
