import type { OwnershipStatus, ReadingStatus } from "@app/shared";

import type { ListDraft } from "./book-organization-fields";

const ACTIVE_READING_STATUSES: readonly ReadingStatus[] = ["reading", "paused", "rereading"];

export type LibraryActions = {
  onAddTags: (input: { bookIds: string[]; tags: string[] }) => Promise<void>;
  onAddToList: (input: {
    bookIds: string[];
    listIds: string[];
    newLists: ListDraft[];
  }) => Promise<void>;
  onAddToQueue: (bookIds: string[]) => Promise<void>;
  onChangeOwnership: (input: {
    bookIds: string[];
    ownershipStatus: OwnershipStatus;
  }) => Promise<void>;
  onChangeReadingStatus: (input: {
    bookIds: string[];
    readingStatus: ReadingStatus;
  }) => Promise<void>;
  onDelete: (bookIds: string[]) => Promise<void>;
  onEdit: (bookId: string) => void;
  onRemoveFromQueue: (bookId: string) => Promise<void>;
  onSetFavorite: (input: { bookIds: string[]; isFavorite: boolean }) => Promise<void>;
  onToggleFavorite: (input: { id: string; isFavorite: boolean }) => void;
};

export type PendingBookAction = {
  bookIds: string[];
  clearSelectionOnSuccess: boolean;
  defaultOwnershipStatus?: OwnershipStatus;
  defaultReadingStatus?: ReadingStatus;
  title?: string;
  type: PendingBookActionType;
};

export type PendingBookActionType = "delete" | "list" | "ownership" | "readingStatus" | "tags";

export function canMarkFinished(readingStatus: ReadingStatus): boolean {
  return readingStatus !== "finished";
}

export function canStartReading(readingStatus: ReadingStatus): boolean {
  return !ACTIVE_READING_STATUSES.includes(readingStatus);
}
