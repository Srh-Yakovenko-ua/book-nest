import type { Nullable } from "@app/shared";

import { normalizeName } from "../core/normalize-name.js";

export type AuthorNameSeed = {
  isPrimary: boolean;
  locale: string;
  name: string;
  normalizedName: string;
};

export type AuthorSeedInput = {
  bio: Nullable<string>;
  birthYear: Nullable<number>;
  countryCode: Nullable<string>;
  deathYear: Nullable<number>;
  name: string;
  names: AuthorNameSeed[];
  normalizedName: string;
  openLibraryKey: Nullable<string>;
  photoAttribution: Nullable<string>;
  photoLicense: Nullable<string>;
  photoLicenseUrl: Nullable<string>;
  photoUrl: Nullable<string>;
  searchText: string;
  userId: null;
  wikidataId: string;
};

export type WikidataAuthorRow = {
  aliasEn: Nullable<string>;
  aliasRu: Nullable<string>;
  aliasUk: Nullable<string>;
  authorDescription: Nullable<string>;
  birth: Nullable<string>;
  countryCode: Nullable<string>;
  death: Nullable<string>;
  image: Nullable<string>;
  labelEn: Nullable<string>;
  labelUk: Nullable<string>;
  openLibraryKey: Nullable<string>;
  wikidataId: string;
};

const OPEN_LIBRARY_AUTHOR_KEY = /^OL\d+A$/;
const ISO_YEAR = /^-?\d{4,}/;
const ALIAS_SEPARATOR = "|";

export function mapWikidataAuthorRow(row: WikidataAuthorRow): Nullable<AuthorSeedInput> {
  const labelEn = trimToNull(row.labelEn);
  const labelUk = trimToNull(row.labelUk);
  const canonicalName = labelEn ?? labelUk;
  if (canonicalName === null) {
    return null;
  }

  const names = buildNames(row, labelEn, labelUk);

  return {
    bio: trimToNull(row.authorDescription),
    birthYear: parseYear(row.birth),
    countryCode: row.countryCode === null ? null : row.countryCode.toUpperCase(),
    deathYear: parseYear(row.death),
    name: canonicalName,
    names,
    normalizedName: normalizeName(canonicalName),
    openLibraryKey: normalizeOpenLibraryKey(row.openLibraryKey),
    photoAttribution: null,
    photoLicense: null,
    photoLicenseUrl: null,
    photoUrl: row.image,
    searchText: buildSearchText(names),
    userId: null,
    wikidataId: row.wikidataId,
  };
}

function addName(
  names: AuthorNameSeed[],
  seen: Set<string>,
  locale: string,
  label: Nullable<string>,
  isPrimary: boolean,
): void {
  const name = trimToNull(label);
  if (name === null) {
    return;
  }
  const normalizedName = normalizeName(name);
  const key = `${locale}:${normalizedName}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  names.push({ isPrimary, locale, name, normalizedName });
}

function buildNames(
  row: WikidataAuthorRow,
  labelEn: Nullable<string>,
  labelUk: Nullable<string>,
): AuthorNameSeed[] {
  const names: AuthorNameSeed[] = [];
  const seen = new Set<string>();

  for (const primary of [
    { label: labelEn, locale: "en" },
    { label: labelUk, locale: "uk" },
  ]) {
    addName(names, seen, primary.locale, primary.label, true);
  }

  for (const alias of [
    { locale: "en", raw: row.aliasEn },
    { locale: "uk", raw: row.aliasUk },
    { locale: "ru", raw: row.aliasRu },
  ]) {
    for (const aliasName of splitAliases(alias.raw)) {
      addName(names, seen, alias.locale, aliasName, false);
    }
  }

  return names;
}

function buildSearchText(names: AuthorNameSeed[]): string {
  const tokens = new Set<string>();
  for (const authorName of names) {
    if (authorName.normalizedName.length > 0) {
      tokens.add(authorName.normalizedName);
    }
  }
  return [...tokens].join(" ");
}

function normalizeOpenLibraryKey(key: Nullable<string>): Nullable<string> {
  if (key === null) {
    return null;
  }
  return OPEN_LIBRARY_AUTHOR_KEY.test(key) ? key : null;
}

function parseYear(isoDateTime: Nullable<string>): Nullable<number> {
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

function splitAliases(raw: Nullable<string>): string[] {
  if (raw === null) {
    return [];
  }
  return raw
    .split(ALIAS_SEPARATOR)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

function trimToNull(value: Nullable<string>): Nullable<string> {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
