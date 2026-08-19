import type { Nullable } from "@app/shared";

export function rangeLabel<TValue>({
  from,
  max,
  min,
  range,
  to,
}: {
  from: (value: TValue) => string;
  max: Nullable<TValue>;
  min: Nullable<TValue>;
  range: (min: TValue, max: TValue) => string;
  to: (value: TValue) => string;
}): Nullable<string> {
  if (min !== null && max !== null) return range(min, max);
  if (min !== null) return from(min);
  if (max !== null) return to(max);
  return null;
}
