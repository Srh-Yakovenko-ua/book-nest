import type { AuthorLocale, AuthorView } from "@app/shared";

import type { AuthorWithPrimaryNames } from "../infrastructure/authors.repository.js";

export function toAuthorView(author: AuthorWithPrimaryNames, locale: AuthorLocale): AuthorView {
  const localized = author.names.find((authorName) => authorName.locale === locale);

  return {
    bio: author.bio,
    birthYear: author.birthYear,
    countryCode: author.countryCode,
    deathYear: author.deathYear,
    id: author.id,
    isCustom: author.userId !== null,
    name: localized?.name ?? author.name,
    openLibraryKey: author.openLibraryKey,
    photoAttribution: author.photoAttribution,
    photoLicense: author.photoLicense,
    photoLicenseUrl: author.photoLicenseUrl,
    photoUrl: author.photoUrl,
  };
}
