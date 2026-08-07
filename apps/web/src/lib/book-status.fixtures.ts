import { type StatusDefinition, type StatusEntry } from "./book-status";

export function statusEntry(
  entries: readonly StatusDefinition[],
  value: string,
  label: string,
): StatusEntry {
  const base = entries.find((entry) => entry.value === value);
  if (base === undefined) {
    throw new Error(`Unknown status value: ${value}`);
  }
  return { ...base, label };
}
