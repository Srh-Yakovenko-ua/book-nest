import type { Nullable } from "@app/shared";

import { getUnixTime } from "date-fns";

export const STALE_ACCESS_TOKEN_CODE = "access_token_stale";

export function isAccessTokenStale({
  issuedAt,
  passwordChangedAt,
}: {
  issuedAt: Date;
  passwordChangedAt: Nullable<Date>;
}): boolean {
  if (passwordChangedAt === null) {
    return false;
  }

  return getUnixTime(issuedAt) < getUnixTime(passwordChangedAt);
}
