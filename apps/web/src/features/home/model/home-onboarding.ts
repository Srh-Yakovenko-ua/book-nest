import type { Nullable } from "@app/shared";

export type HomePresence = "absent" | "present" | "unknown";

export function isConfirmedEmptyHome({
  independentPresence,
  libraryTotal,
}: {
  independentPresence: readonly HomePresence[];
  libraryTotal: Nullable<number>;
}): boolean {
  return libraryTotal === 0 && independentPresence.every((presence) => presence === "absent");
}
