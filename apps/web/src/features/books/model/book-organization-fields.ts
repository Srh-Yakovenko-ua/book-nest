import type { NewListInput, QueuePriority } from "@app/shared";

export const QUEUE_PRIORITY_OPTIONS = [
  "low",
  "normal",
  "high",
] as const satisfies readonly QueuePriority[];

export const QUEUE_PRIORITY_DEFAULT = "normal" satisfies QueuePriority;

export const BOOK_LIST_IDS_MAX = 50;
export const BOOK_NEW_LISTS_MAX = 20;
export const LIST_NAME_MAX = 80;
export const LIST_DESCRIPTION_MAX = 300;

export type ListDraft = NewListInput;

const LIST_DRAFT_VALUE_PREFIX = "draft:";

export function draftListValue(name: string): string {
  return `${LIST_DRAFT_VALUE_PREFIX}${name}`;
}

export function draftNameFromValue(value: string): string {
  return value.slice(LIST_DRAFT_VALUE_PREFIX.length);
}

export function isDraftListValue(value: string): boolean {
  return value.startsWith(LIST_DRAFT_VALUE_PREFIX);
}

export function splitListSelection({
  drafts,
  selection,
}: {
  drafts: ListDraft[];
  selection: string[];
}): { listIds: string[]; newLists: ListDraft[] } {
  const draftNames = new Set(selection.filter(isDraftListValue).map(draftNameFromValue));
  return {
    listIds: selection.filter((value) => !isDraftListValue(value)),
    newLists: drafts.filter((draft) => draftNames.has(draft.name)),
  };
}
