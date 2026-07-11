import type { AddToReadingQueueInput, ReadingQueueItemView } from "@app/shared";

export type QueueAddChoice =
  | { placement: "end" }
  | { placement: "relative"; relativePosition: number; side: QueueRelativeSide }
  | { placement: "specific"; position: number }
  | { placement: "start" };

export type QueueMode = "add" | "move";

export type QueueMoveChoice =
  | { placement: "end" }
  | { placement: "relative"; relativeBookId: string; side: QueueRelativeSide }
  | { placement: "specific"; position: number }
  | { placement: "start" };

export type QueueOutcome =
  | { kind: "end"; position: number }
  | { kind: "first" }
  | { kind: "relative"; position: number; side: QueueRelativeSide; title: string }
  | { kind: "specific"; position: number };

export type QueuePickerItem = {
  id: string;
  position: number;
  title: string;
};

export type QueuePlacementChoice = "end" | "relative" | "specific" | "start";

export type QueueRelativeSide = "after" | "before";

export const QUEUE_PLACEMENT_OPTIONS = [
  "start",
  "end",
  "specific",
  "relative",
] as const satisfies readonly QueuePlacementChoice[];

export function buildAddInput({
  bookId,
  choice,
  queueLength,
}: {
  bookId: string;
  choice: QueueAddChoice;
  queueLength: number;
}): AddToReadingQueueInput {
  if (queueLength === 0) return { bookId, placement: "specific", position: 1 };

  switch (choice.placement) {
    case "end":
      return { bookId, placement: "end" };
    case "relative":
      return {
        bookId,
        placement: "specific",
        position: choice.side === "before" ? choice.relativePosition : choice.relativePosition + 1,
      };
    case "specific":
      return { bookId, placement: "specific", position: choice.position };
    case "start":
      return { bookId, placement: "start" };
  }
}

export function buildMoveOrder({
  choice,
  currentBookId,
  orderedBookIds,
}: {
  choice: QueueMoveChoice;
  currentBookId: string;
  orderedBookIds: string[];
}): null | string[] {
  const without = orderedBookIds.filter((id) => id !== currentBookId);
  const index = resolveMoveIndex({ choice, without });
  if (index === null) return null;

  const clamped = Math.min(Math.max(index, 0), without.length);
  return [...without.slice(0, clamped), currentBookId, ...without.slice(clamped)];
}

export function isQueuePlacementChoice(value: string): value is QueuePlacementChoice {
  return (QUEUE_PLACEMENT_OPTIONS as readonly string[]).includes(value);
}

export function isQueueRelativeSide(value: string): value is QueueRelativeSide {
  return value === "before" || value === "after";
}

export function maxQueuePosition({
  mode,
  queueLength,
}: {
  mode: QueueMode;
  queueLength: number;
}): number {
  return mode === "add" ? queueLength + 1 : queueLength;
}

export function toQueuePickerItems(items: ReadingQueueItemView[]): QueuePickerItem[] {
  return [...items]
    .sort((left, right) => left.position - right.position)
    .map((item) => ({ id: item.book.id, position: item.position, title: item.book.title }));
}

function resolveMoveIndex({
  choice,
  without,
}: {
  choice: QueueMoveChoice;
  without: string[];
}): null | number {
  switch (choice.placement) {
    case "end":
      return without.length;
    case "relative": {
      const index = without.indexOf(choice.relativeBookId);
      if (index === -1) return null;
      return choice.side === "before" ? index : index + 1;
    }
    case "specific":
      return choice.position - 1;
    case "start":
      return 0;
  }
}
