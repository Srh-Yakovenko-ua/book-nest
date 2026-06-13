import type { AuthorView } from "@app/shared";

import type { AuthorModel } from "../../../generated/prisma/models.js";

export function toAuthorView(author: AuthorModel): AuthorView {
  return {
    bio: author.bio,
    birthYear: author.birthYear,
    countryCode: author.countryCode,
    deathYear: author.deathYear,
    id: author.id,
    isCustom: author.userId !== null,
    name: author.name,
    openLibraryKey: author.openLibraryKey,
    photoAttribution: author.photoAttribution,
    photoLicense: author.photoLicense,
    photoLicenseUrl: author.photoLicenseUrl,
    photoUrl: author.photoUrl,
  };
}
