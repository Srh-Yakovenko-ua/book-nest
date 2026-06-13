import { normalizeName } from "../core/normalize-name.js";

export type PublisherNameSeed = {
  isPrimary: boolean;
  locale: string;
  name: string;
  normalizedName: string;
};

export type PublisherSeedInput = {
  countryCode: null | string;
  foundedYear: null | number;
  logoAttribution: null | string;
  logoLicense: null | string;
  logoLicenseUrl: null | string;
  logoUrl: null | string;
  name: string;
  names: PublisherNameSeed[];
  normalizedName: string;
  searchText: string;
  userId: null;
  websiteUrl: null | string;
  wikidataId: string;
};

export type WikidataPublisherRow = {
  aliasEn: null | string;
  aliasRu: null | string;
  aliasUk: null | string;
  countryCode: null | string;
  inception: null | string;
  labelEn: null | string;
  labelUk: null | string;
  logo: null | string;
  website: null | string;
  wikidataId: string;
};

const ISO_YEAR = /^-?\d{4,}/;
const ALIAS_SEPARATOR = "|";

export function mapWikidataPublisherRow(row: WikidataPublisherRow): null | PublisherSeedInput {
  const labelEn = trimToNull(row.labelEn);
  const labelUk = trimToNull(row.labelUk);
  const canonicalName = labelEn ?? labelUk;
  if (canonicalName === null) {
    return null;
  }

  const names = buildNames(row, labelEn, labelUk);

  return {
    countryCode: row.countryCode === null ? null : row.countryCode.toUpperCase(),
    foundedYear: parseYear(row.inception),
    logoAttribution: null,
    logoLicense: null,
    logoLicenseUrl: null,
    logoUrl: row.logo,
    name: canonicalName,
    names,
    normalizedName: normalizeName(canonicalName),
    searchText: buildSearchText(names),
    userId: null,
    websiteUrl: row.website,
    wikidataId: row.wikidataId,
  };
}

function addName(
  names: PublisherNameSeed[],
  seen: Set<string>,
  locale: string,
  label: null | string,
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
  row: WikidataPublisherRow,
  labelEn: null | string,
  labelUk: null | string,
): PublisherNameSeed[] {
  const names: PublisherNameSeed[] = [];
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

function buildSearchText(names: PublisherNameSeed[]): string {
  const tokens = new Set<string>();
  for (const publisherName of names) {
    if (publisherName.normalizedName.length > 0) {
      tokens.add(publisherName.normalizedName);
    }
  }
  return [...tokens].join(" ");
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

function splitAliases(raw: null | string): string[] {
  if (raw === null) {
    return [];
  }
  return raw
    .split(ALIAS_SEPARATOR)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

function trimToNull(value: null | string): null | string {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
