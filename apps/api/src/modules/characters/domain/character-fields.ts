import type { Nullable } from "@app/shared";

export function emptyToNull(value: Nullable<string> | undefined): Nullable<string> {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
