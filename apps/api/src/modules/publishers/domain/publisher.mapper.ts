import type { CatalogLocale, PublisherView } from "@app/shared";

import type { PublisherWithPrimaryNames } from "../infrastructure/publishers.repository.js";

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
