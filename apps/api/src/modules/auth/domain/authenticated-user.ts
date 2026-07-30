import type { Nullable, Role } from "@app/shared";

import type { UserModel } from "../../../generated/prisma/models.js";

export type AuthenticatedSession = {
  accessTokenExpiresAt: Date;
  user: AuthenticatedUser;
};

export type AuthenticatedUser = {
  createdAt: Date;
  dateOfBirth: Nullable<Date>;
  email: string;
  emailVerifiedAt: Nullable<Date>;
  id: string;
  name: string;
  nickname: Nullable<string>;
  role: Role;
};

export function toAuthenticatedUser(user: UserModel): AuthenticatedUser {
  return {
    createdAt: user.createdAt,
    dateOfBirth: user.dateOfBirth,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    role: user.role,
  };
}
