import { normalizeName } from "../core/normalize-name.js";

export type PublisherSeedInput = {
  countryCode: null | string;
  foundedYear: null | number;
  logoUrl: null | string;
  name: string;
  normalizedName: string;
  userId: null;
  websiteUrl: null | string;
  wikidataId: string;
};

export type WikidataPublisherRow = {
  countryCode: null | string;
  inception: null | string;
  logo: null | string;
  publisherLabel: null | string;
  website: null | string;
  wikidataId: string;
};

const ISO_YEAR = /^-?\d{4,}/;

export function mapWikidataPublisherRow(row: WikidataPublisherRow): null | PublisherSeedInput {
  const name = row.publisherLabel?.trim() ?? "";
  if (name.length === 0) {
    return null;
  }

  return {
    countryCode: row.countryCode === null ? null : row.countryCode.toUpperCase(),
    foundedYear: parseYear(row.inception),
    logoUrl: row.logo,
    name,
    normalizedName: normalizeName(name),
    userId: null,
    websiteUrl: row.website,
    wikidataId: row.wikidataId,
  };
}

function parseYear(isoDateTime: null | string): null | number {
  if (isoDateTime === null) {
    return null;
  }
  const match = ISO_YEAR.exec(isoDateTime);
  const captured = match?.[0];
  if (captured === undefined) {
    return null;
  }
  const year = Number.parseInt(captured, 10);
  return Number.isNaN(year) ? null : year;
}
