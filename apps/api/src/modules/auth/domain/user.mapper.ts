import type { UserView } from "@app/shared";

import type { UserModel } from "../../../generated/prisma/models.js";

export function toUserView(user: UserModel): UserView {
  return {
    createdAt: user.createdAt.toISOString(),
    dateOfBirth: user.dateOfBirth === null ? null : user.dateOfBirth.toISOString().slice(0, 10),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    id: user.id,
    name: user.name,
    nickname: user.nickname,
  };
}
