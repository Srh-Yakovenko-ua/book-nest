import { describe, expect, it } from "vitest";

import type { WikidataAuthorRow } from "./map-wikidata-author-row.js";

import { mapWikidataAuthorRow } from "./map-wikidata-author-row.js";

function row(overrides: Partial<WikidataAuthorRow> = {}): WikidataAuthorRow {
  return {
    authorDescription: "Ukrainian poet",
    authorLabel: "Taras Shevchenko",
    birth: "1814-03-09T00:00:00Z",
    countryCode: "ua",
    death: "1861-03-10T00:00:00Z",
    image: "https://example.org/shevchenko.jpg",
    openLibraryKey: "OL123A",
    wikidataId: "Q173663",
    ...overrides,
  };
}

describe("mapWikidataAuthorRow", () => {
  it("maps a full row into a complete author seed input", () => {
    const result = mapWikidataAuthorRow(row());

    expect(result).toEqual({
      bio: "Ukrainian poet",
      birthYear: 1814,
      countryCode: "UA",
      deathYear: 1861,
      name: "Taras Shevchenko",
      normalizedName: "taras shevchenko",
      openLibraryKey: "OL123A",
      photoAttribution: null,
      photoLicense: null,
      photoLicenseUrl: null,
      photoUrl: "https://example.org/shevchenko.jpg",
      userId: null,
      wikidataId: "Q173663",
    });
  });

  it("returns null when the author label is missing", () => {
    const result = mapWikidataAuthorRow(row({ authorLabel: null }));

    expect(result).toBeNull();
  });

  it("returns null when the author label is only whitespace", () => {
    const result = mapWikidataAuthorRow(row({ authorLabel: "   " }));

    expect(result).toBeNull();
  });

  it("maps missing optional fields to nulls", () => {
    const result = mapWikidataAuthorRow(
      row({
        authorDescription: null,
        birth: null,
        countryCode: null,
        death: null,
        image: null,
        openLibraryKey: null,
      }),
    );

    expect(result).toMatchObject({
      bio: null,
      birthYear: null,
      countryCode: null,
      deathYear: null,
      openLibraryKey: null,
      photoUrl: null,
    });
  });

  it("parses the birth year from an ISO datetime", () => {
    const result = mapWikidataAuthorRow(row({ birth: "1828-01-01T00:00:00Z" }));

    expect(result?.birthYear).toBe(1828);
  });

  it("parses the death year from an ISO datetime", () => {
    const result = mapWikidataAuthorRow(row({ death: "1910-11-20T00:00:00Z" }));

    expect(result?.deathYear).toBe(1910);
  });

  it("uppercases the country code", () => {
    const result = mapWikidataAuthorRow(row({ countryCode: "fr" }));

    expect(result?.countryCode).toBe("FR");
  });

  it("passes the bare wikidata id through unchanged", () => {
    const result = mapWikidataAuthorRow(row({ wikidataId: "Q42" }));

    expect(result?.wikidataId).toBe("Q42");
  });

  it("keeps an open library key that matches the author id pattern", () => {
    const result = mapWikidataAuthorRow(row({ openLibraryKey: "OL9999999A" }));

    expect(result?.openLibraryKey).toBe("OL9999999A");
  });

  it("drops a non-author open library id such as a work id", () => {
    const result = mapWikidataAuthorRow(row({ openLibraryKey: "OL123W" }));

    expect(result?.openLibraryKey).toBeNull();
  });

  it("drops an open library key that is not in the OLxxxA shape", () => {
    const result = mapWikidataAuthorRow(row({ openLibraryKey: "https://openlibrary.org/OL1A" }));

    expect(result?.openLibraryKey).toBeNull();
  });

  it("trims and collapses whitespace when normalizing the name", () => {
    const result = mapWikidataAuthorRow(row({ authorLabel: "  Lesya   Ukrainka  " }));

    expect(result?.name).toBe("Lesya   Ukrainka");
    expect(result?.normalizedName).toBe("lesya ukrainka");
  });

  it("trims the bio and falls back to null when it is blank", () => {
    const result = mapWikidataAuthorRow(row({ authorDescription: "   " }));

    expect(result?.bio).toBeNull();
  });
});
