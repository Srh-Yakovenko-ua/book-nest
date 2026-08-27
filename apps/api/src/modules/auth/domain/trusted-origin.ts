const SAME_ORIGIN_FETCH_SITE = "same-origin";
const TRAILING_SLASHES = /\/+$/;

export function isTrustedOrigin({
  origin,
  secFetchSite,
  trustedOrigins,
}: {
  origin: string | undefined;
  secFetchSite: string | undefined;
  trustedOrigins: readonly string[];
}): boolean {
  if (origin === undefined) {
    return secFetchSite?.trim().toLowerCase() === SAME_ORIGIN_FETCH_SITE;
  }

  const presented = normalizeOrigin(origin);

  return trustedOrigins.some((trusted) => normalizeOrigin(trusted) === presented);
}

function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(TRAILING_SLASHES, "");
}
