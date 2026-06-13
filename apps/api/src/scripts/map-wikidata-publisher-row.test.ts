import { describe, expect, it } from "vitest";

import type { WikidataPublisherRow } from "./map-wikidata-publisher-row.js";

import { mapWikidataPublisherRow } from "./map-wikidata-publisher-row.js";

function row(overrides: Partial<WikidataPublisherRow> = {}): WikidataPublisherRow {
  return {
    countryCode: "ua",
    inception: "1918-01-01T00:00:00Z",
    logo: "https://example.org/logo.svg",
    publisherLabel: "Vydavnytstvo",
    website: "https://example.org",
    wikidataId: "Q12345",
    ...overrides,
  };
}

describe("mapWikidataPublisherRow", () => {
  it("maps a full row into a complete publisher seed input", () => {
    const result = mapWikidataPublisherRow(row());

    expect(result).toEqual({
      countryCode: "UA",
      foundedYear: 1918,
      logoAttribution: null,
      logoLicense: null,
      logoLicenseUrl: null,
      logoUrl: "https://example.org/logo.svg",
      name: "Vydavnytstvo",
      normalizedName: "vydavnytstvo",
      userId: null,
      websiteUrl: "https://example.org",
      wikidataId: "Q12345",
    });
  });

  it("returns null when the publisher label is missing", () => {
    const result = mapWikidataPublisherRow(row({ publisherLabel: null }));

    expect(result).toBeNull();
  });

  it("returns null when the publisher label is only whitespace", () => {
    const result = mapWikidataPublisherRow(row({ publisherLabel: "   " }));

    expect(result).toBeNull();
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
    const result = mapWikidataPublisherRow(row({ publisherLabel: "  Vydavnytstvo   Stary Lev  " }));

    expect(result?.name).toBe("Vydavnytstvo   Stary Lev");
    expect(result?.normalizedName).toBe("vydavnytstvo stary lev");
  });

  it("sets the user id to null for a seeded global publisher", () => {
    const result = mapWikidataPublisherRow(row());

    expect(result?.userId).toBeNull();
  });
});
