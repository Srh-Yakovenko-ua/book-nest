import type { Nullable } from "@app/shared";

export function emptyToNull(value: unknown): Nullable<string> {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
