import type {
  CatalogLocale,
  PublisherDuplicateCandidate,
  PublisherMatchKind,
  PublisherView,
} from "@app/shared";

import type {
  PublisherWithNames,
  PublisherWithPrimaryNames,
} from "../infrastructure/publishers.repository.js";

export function toPublisherDuplicateCandidate({
  locale,
  matchKind,
  publisher,
}: {
  locale: CatalogLocale;
  matchKind: PublisherMatchKind;
  publisher: PublisherWithNames;
}): PublisherDuplicateCandidate {
  return {
    id: publisher.id,
    isCustom: publisher.userId !== null,
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

function toPublisherDisplayName(publisher: PublisherWithNames, locale: CatalogLocale): string {
  const localized = publisher.names.find(
    (publisherName) => publisherName.isPrimary && publisherName.locale === locale,
  );
  const primary = publisher.names.find((publisherName) => publisherName.isPrimary);

  return localized?.name ?? primary?.name ?? publisher.name;
}
