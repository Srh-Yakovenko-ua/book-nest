import { describe, expect, it } from "vitest";

import type { WikidataPublisherRow } from "./map-wikidata-publisher-row.js";

import { mapWikidataPublisherRow } from "./map-wikidata-publisher-row.js";

function row(overrides: Partial<WikidataPublisherRow> = {}): WikidataPublisherRow {
  return {
    aliasEn: null,
    aliasRu: null,
    aliasUk: null,
    countryCode: "ua",
    inception: "1918-01-01T00:00:00Z",
    labelEn: "Vydavnytstvo Stary Lev",
    labelUk: "Видавництво Старого Лева",
    logo: "https://example.org/logo.svg",
    website: "https://example.org",
    wikidataId: "Q12345",
    ...overrides,
  };
}

describe("mapWikidataPublisherRow", () => {
  it("maps a full row into a complete publisher seed input", () => {
    const result = mapWikidataPublisherRow(row({ aliasEn: "Stary Lev", aliasUk: "Старий Лев" }));

    expect(result).toEqual({
      countryCode: "UA",
      foundedYear: 1918,
      logoAttribution: null,
      logoLicense: null,
      logoLicenseUrl: null,
      logoUrl: "https://example.org/logo.svg",
      name: "Vydavnytstvo Stary Lev",
      names: [
        {
          isPrimary: true,
          locale: "en",
          name: "Vydavnytstvo Stary Lev",
          normalizedName: "vydavnytstvo stary lev",
        },
        {
          isPrimary: true,
          locale: "uk",
          name: "Видавництво Старого Лева",
          normalizedName: "видавництво старого лева",
        },
        { isPrimary: false, locale: "en", name: "Stary Lev", normalizedName: "stary lev" },
        { isPrimary: false, locale: "uk", name: "Старий Лев", normalizedName: "старий лев" },
      ],
      normalizedName: "vydavnytstvo stary lev",
      searchText: "vydavnytstvo stary lev видавництво старого лева stary lev старий лев",
      userId: null,
      websiteUrl: "https://example.org",
      wikidataId: "Q12345",
    });
  });

  it("returns null when both english and ukrainian labels are missing", () => {
    const result = mapWikidataPublisherRow(row({ labelEn: null, labelUk: null }));

    expect(result).toBeNull();
  });

  it("returns null when both labels are only whitespace", () => {
    const result = mapWikidataPublisherRow(row({ labelEn: "   ", labelUk: "  " }));

    expect(result).toBeNull();
  });

  it("falls back to the ukrainian label when the english label is missing", () => {
    const result = mapWikidataPublisherRow(row({ labelEn: null }));

    expect(result?.name).toBe("Видавництво Старого Лева");
    expect(result?.normalizedName).toBe("видавництво старого лева");
  });

  it("builds a primary name row per available locale", () => {
    const result = mapWikidataPublisherRow(row());

    expect(result?.names).toEqual([
      {
        isPrimary: true,
        locale: "en",
        name: "Vydavnytstvo Stary Lev",
        normalizedName: "vydavnytstvo stary lev",
      },
      {
        isPrimary: true,
        locale: "uk",
        name: "Видавництво Старого Лева",
        normalizedName: "видавництво старого лева",
      },
    ]);
  });

  it("splits pipe separated aliases into per-locale alias rows", () => {
    const result = mapWikidataPublisherRow(
      row({ aliasEn: "Stary Lev|VSL", aliasRu: "Издательство Старого Льва" }),
    );

    expect(result?.names).toEqual(
      expect.arrayContaining([
        { isPrimary: false, locale: "en", name: "Stary Lev", normalizedName: "stary lev" },
        { isPrimary: false, locale: "en", name: "VSL", normalizedName: "vsl" },
        {
          isPrimary: false,
          locale: "ru",
          name: "Издательство Старого Льва",
          normalizedName: "издательство старого льва",
        },
      ]),
    );
  });

  it("drops an alias that duplicates a primary name in the same locale", () => {
    const result = mapWikidataPublisherRow(row({ aliasEn: "Vydavnytstvo Stary Lev" }));

    const englishNames =
      result?.names.filter((publisherName) => publisherName.locale === "en") ?? [];
    expect(englishNames).toEqual([
      {
        isPrimary: true,
        locale: "en",
        name: "Vydavnytstvo Stary Lev",
        normalizedName: "vydavnytstvo stary lev",
      },
    ]);
  });

  it("builds search text from unique normalized name tokens", () => {
    const result = mapWikidataPublisherRow(row({ aliasEn: "Stary Lev|Stary Lev" }));

    expect(result?.searchText).toBe("vydavnytstvo stary lev видавництво старого лева stary lev");
  });

  it("maps missing optional fields to nulls", () => {
    const result = mapWikidataPublisherRow(
      row({
        countryCode: null,
        inception: null,
        logo: null,
        website: null,
      }),
    );

    expect(result).toMatchObject({
      countryCode: null,
      foundedYear: null,
      logoUrl: null,
      websiteUrl: null,
    });
  });

  it("parses the founded year from an inception ISO datetime", () => {
    const result = mapWikidataPublisherRow(row({ inception: "1817-01-01T00:00:00Z" }));

    expect(result?.foundedYear).toBe(1817);
  });

  it("parses a BCE founded year from a negative inception", () => {
    const result = mapWikidataPublisherRow(row({ inception: "-0500-01-01T00:00:00Z" }));

    expect(result?.foundedYear).toBe(-500);
  });

  it("parses a five-digit founded year from a far-future inception", () => {
    const result = mapWikidataPublisherRow(row({ inception: "10000-01-01T00:00:00Z" }));

    expect(result?.foundedYear).toBe(10000);
  });

  it("maps the founded year to null when the inception does not start with a year", () => {
    const result = mapWikidataPublisherRow(row({ inception: "unknown" }));

    expect(result?.foundedYear).toBeNull();
  });

  it("uppercases the country code", () => {
    const result = mapWikidataPublisherRow(row({ countryCode: "fr" }));

    expect(result?.countryCode).toBe("FR");
  });

  it("passes the bare wikidata id through unchanged", () => {
    const result = mapWikidataPublisherRow(row({ wikidataId: "Q42" }));

    expect(result?.wikidataId).toBe("Q42");
  });

  it("trims the name while collapsing inner whitespace only when normalizing", () => {
    const result = mapWikidataPublisherRow(row({ labelEn: "  Vydavnytstvo   Stary Lev  " }));

    expect(result?.name).toBe("Vydavnytstvo   Stary Lev");
    expect(result?.normalizedName).toBe("vydavnytstvo stary lev");
  });

  it("sets the user id to null for a seeded global publisher", () => {
    const result = mapWikidataPublisherRow(row());

    expect(result?.userId).toBeNull();
  });
});
