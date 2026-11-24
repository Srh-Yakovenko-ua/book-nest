export const SORT_ORDER = { after: 1, before: -1, same: 0 } as const;

export function compareText(left: string, right: string): number {
  if (left === right) {
    return SORT_ORDER.same;
  }
  return left < right ? SORT_ORDER.before : SORT_ORDER.after;
}
