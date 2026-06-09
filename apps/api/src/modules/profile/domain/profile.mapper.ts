import type { ProfileView } from "@app/shared";

import { format } from "date-fns";

import type { ProfileWithSocialLinks } from "../infrastructure/profile.repository.js";

import { toSocialLinkView } from "./social-link.mapper.js";

const DATE_FORMAT = "yyyy-MM-dd";

export function toProfileView(user: ProfileWithSocialLinks): ProfileView {
  return {
    authProvider: "PASSWORD",
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
    dateOfBirth: user.dateOfBirth === null ? null : format(user.dateOfBirth, DATE_FORMAT),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    favoriteBookQuote: user.favoriteBookQuote,
    favoriteGenres: user.favoriteGenres,
    lastName: user.lastName,
    name: user.name,
    nickname: user.nickname,
    socialLinks: user.socialLinks.map(toSocialLinkView),
    updatedAt: user.updatedAt.toISOString(),
    userId: user.id,
  };
}
