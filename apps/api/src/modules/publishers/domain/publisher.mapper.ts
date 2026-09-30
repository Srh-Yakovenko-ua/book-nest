import type {
  CatalogLocale,
  Nullable,
  PublisherDuplicateCandidate,
  PublisherMatchKind,
  PublisherView,
} from "@app/shared";

import type {
  PublisherWithNames,
  PublisherWithPrimaryNames,
} from "../infrastructure/publishers.repository.js";

type PublisherNameRow = PublisherWithNames["names"][number];

export function toPublisherDuplicateCandidate({
  locale,
  matchedNormalizedName,
  matchKind,
  publisher,
}: {
  locale: CatalogLocale;
  matchedNormalizedName?: string;
  matchKind: PublisherMatchKind;
  publisher: PublisherWithNames;
}): PublisherDuplicateCandidate {
  return {
    id: publisher.id,
    isCustom: publisher.userId !== null,
    matchedName: toMatchedName({ locale, matchedNormalizedName, publisher }),
    matchKind,
    name: toPublisherDisplayName(publisher, locale),
  };
}

export function toPublisherView(
  publisher: PublisherWithPrimaryNames,
  locale: CatalogLocale,
): PublisherView {
  const localized = publisher.names.find((publisherName) => publisherName.locale === locale);

  return {
    countryCode: publisher.countryCode,
    foundedYear: publisher.foundedYear,
    id: publisher.id,
    isCustom: publisher.userId !== null,
    logoAttribution: publisher.logoAttribution,
    logoLicense: publisher.logoLicense,
    logoLicenseUrl: publisher.logoLicenseUrl,
    logoUrl: publisher.logoUrl,
    name: localized?.name ?? publisher.name,
    websiteUrl: publisher.websiteUrl,
  };
}

function compareMatchedNames({
  left,
  locale,
  right,
}: {
  left: PublisherNameRow;
  locale: CatalogLocale;
  right: PublisherNameRow;
}): number {
  if (left.locale !== right.locale) {
    if (left.locale === locale) {
      return -1;
    }
    if (right.locale === locale) {
      return 1;
    }
  }
  if (left.isPrimary !== right.isPrimary) {
    return left.isPrimary ? -1 : 1;
  }
  if (left.name !== right.name) {
    return left.name < right.name ? -1 : 1;
  }
  if (left.id === right.id) {
    return 0;
  }
  return left.id < right.id ? -1 : 1;
}

function toMatchedName({
  locale,
  matchedNormalizedName,
  publisher,
}: {
  locale: CatalogLocale;
  matchedNormalizedName?: string;
  publisher: PublisherWithNames;
}): Nullable<string> {
  if (matchedNormalizedName === undefined) {
    return null;
  }

  const [best] = publisher.names
    .filter((publisherName) => publisherName.normalizedName === matchedNormalizedName)
    .sort((left, right) => compareMatchedNames({ left, locale, right }));

  return best?.name ?? null;
}

function toPublisherDisplayName(publisher: PublisherWithNames, locale: CatalogLocale): string {
  const localized = publisher.names.find(
    (publisherName) => publisherName.isPrimary && publisherName.locale === locale,
  );
  const primary = publisher.names.find((publisherName) => publisherName.isPrimary);

  return localized?.name ?? primary?.name ?? publisher.name;
}
