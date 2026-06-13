import { normalizeName } from "../core/normalize-name.js";

export type AuthorSeedInput = {
  bio: null | string;
  birthYear: null | number;
  countryCode: null | string;
  deathYear: null | number;
  name: string;
  normalizedName: string;
  openLibraryKey: null | string;
  photoAttribution: null | string;
  photoLicense: null | string;
  photoLicenseUrl: null | string;
  photoUrl: null | string;
  userId: null;
  wikidataId: string;
};

export type WikidataAuthorRow = {
  authorDescription: null | string;
  authorLabel: null | string;
  birth: null | string;
  countryCode: null | string;
  death: null | string;
  image: null | string;
  openLibraryKey: null | string;
  wikidataId: string;
};

const OPEN_LIBRARY_AUTHOR_KEY = /^OL\d+A$/;
const ISO_YEAR = /^-?\d{4,}/;

export function mapWikidataAuthorRow(row: WikidataAuthorRow): AuthorSeedInput | null {
  const name = row.authorLabel?.trim() ?? "";
  if (name.length === 0) {
    return null;
  }

  return {
    bio: row.authorDescription?.trim() || null,
    birthYear: parseYear(row.birth),
    countryCode: row.countryCode === null ? null : row.countryCode.toUpperCase(),
    deathYear: parseYear(row.death),
    name,
    normalizedName: normalizeName(name),
    openLibraryKey: normalizeOpenLibraryKey(row.openLibraryKey),
    photoAttribution: null,
    photoLicense: null,
    photoLicenseUrl: null,
    photoUrl: row.image,
    userId: null,
    wikidataId: row.wikidataId,
  };
}

function normalizeOpenLibraryKey(key: null | string): null | string {
  if (key === null) {
    return null;
  }
  return OPEN_LIBRARY_AUTHOR_KEY.test(key) ? key : null;
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
