const LIKE_METACHARACTER_PATTERN = /[\\%_]/g;

export function escapeLikeMetacharacters(value: string): string {
  return value.replace(LIKE_METACHARACTER_PATTERN, "\\$&");
}

export function toLikePattern(value: string): string {
  return `%${escapeLikeMetacharacters(value)}%`;
}
