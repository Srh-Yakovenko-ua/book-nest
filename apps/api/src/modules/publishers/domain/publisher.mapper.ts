import type { PublisherView } from "@app/shared";

import type { PublisherModel } from "../../../generated/prisma/models.js";

export function toPublisherView(publisher: PublisherModel): PublisherView {
  return {
    countryCode: publisher.countryCode,
    foundedYear: publisher.foundedYear,
    id: publisher.id,
    isCustom: publisher.userId !== null,
    logoAttribution: publisher.logoAttribution,
    logoLicense: publisher.logoLicense,
    logoLicenseUrl: publisher.logoLicenseUrl,
    logoUrl: publisher.logoUrl,
    name: publisher.name,
    websiteUrl: publisher.websiteUrl,
  };
}
