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
