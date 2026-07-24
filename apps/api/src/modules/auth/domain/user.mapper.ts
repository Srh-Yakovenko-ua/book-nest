import type { UserView } from "@app/shared";

import type { AuthenticatedUser } from "./authenticated-user.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";

export function toUserView(user: AuthenticatedUser): UserView {
  return {
    createdAt: user.createdAt.toISOString(),
    dateOfBirth: toNullableIsoDate(user.dateOfBirth),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    role: user.role,
  };
}
