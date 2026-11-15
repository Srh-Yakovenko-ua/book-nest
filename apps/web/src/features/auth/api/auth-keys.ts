import type { Nullable } from "@app/shared";

const AUTH_ROOT = "/api/auth";

export const authKeys = {
  nicknameAvailability: (nickname: Nullable<string>) =>
    [`${AUTH_ROOT}/nickname-available`, { nickname }] as const,
};
