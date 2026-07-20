"use client";

import type { ReadingQueueItemView } from "@app/shared";

import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import type { LibraryBook, LibraryBookLabels } from "../model/library-book";
import type { ReadingQueueCard } from "../model/reading-queue-card";

import { toLibraryBook } from "../model/library-book";
import { toReadingQueueCard } from "../model/reading-queue-card";
import { QueueDragHandle, ReadingQueueItem } from "./reading-queue-item";

type ReadingQueueListProps = {
  canMove: boolean;
  draggable: boolean;
  hasSearch: boolean;
  items: ReadingQueueItemView[];
  labels: LibraryBookLabels;
  onDragCommit: () => void;
  onMove: (items: ReadingQueueItemView[]) => void;
  onRemove: (item: ReadingQueueItemView) => void;
  onReorderLocal: (items: ReadingQueueItemView[]) => void;
  onStartReading: (item: ReadingQueueItemView) => void;
};

export function ReadingQueueList({
  canMove,
  draggable,
  hasSearch,
  items,
  labels,
  onDragCommit,
  onMove,
  onRemove,
  onReorderLocal,
  onStartReading,
}: ReadingQueueListProps) {
  const t = useTranslations("readingQueue.item");

  if (draggable) {
    return (
      <Reorder.Group
        as="ol"
        axis="y"
        className="flex flex-col gap-2.5"
        onReorder={onReorderLocal}
        values={items}
      >
        {items.map((item, index) => (
          <DraggableQueueRow
            book={toLibraryBook(item.book, labels)}
            key={item.book.id}
            onDragCommit={onDragCommit}
            onMoveDown={moveDown({ canMove, index, items, onMove })}
            onMoveUp={moveUp({ canMove, index, items, onMove })}
            onRemove={() => onRemove(item)}
            onStartReading={() => onStartReading(item)}
            position={index + 1}
            queue={toReadingQueueCard(item.book, labels.ownershipLabel)}
            reorderLabel={t("reorderAria", { title: item.book.title })}
            value={item}
          />
        ))}
      </Reorder.Group>
    );
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li key={item.book.id}>
          <ReadingQueueItem
            book={toLibraryBook(item.book, labels)}
            dragHandle={
              <QueueDragHandle disabled label={t("reorderAria", { title: item.book.title })} />
            }
            onMoveDown={moveDown({ canMove, index, items, onMove })}
            onMoveUp={moveUp({ canMove, index, items, onMove })}
            onRemove={() => onRemove(item)}
            onStartReading={() => onStartReading(item)}
            position={hasSearch ? item.position : index + 1}
            queue={toReadingQueueCard(item.book, labels.ownershipLabel)}
          />
        </li>
      ))}
    </ol>
  );
}

function DraggableQueueRow({
  book,
  onDragCommit,
  onMoveDown,
  onMoveUp,
  onRemove,
  onStartReading,
  position,
  queue,
  reorderLabel,
  value,
}: {
  book: LibraryBook;
  onDragCommit: () => void;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onRemove: () => void;
  onStartReading: () => void;
  position: number;
  queue: ReadingQueueCard;
  reorderLabel: string;
  value: ReadingQueueItemView;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="li"
      dragControls={controls}
      dragListener={false}
      onDragEnd={onDragCommit}
      value={value}
    >
      <ReadingQueueItem
        book={book}
        dragHandle={
          <QueueDragHandle label={reorderLabel} onPointerDown={(event) => controls.start(event)} />
        }
        onMoveDown={onMoveDown}
        onMoveUp={onMoveUp}
        onRemove={onRemove}
        onStartReading={onStartReading}
        position={position}
        queue={queue}
      />
    </Reorder.Item>
  );
}

function moveDown({
  canMove,
  index,
  items,
  onMove,
}: {
  canMove: boolean;
  index: number;
  items: ReadingQueueItemView[];
  onMove: (items: ReadingQueueItemView[]) => void;
}) {
  if (!canMove || index >= items.length - 1) return undefined;
  return () => onMove(swapItems(items, index, index + 1));
}

function moveUp({
  canMove,
  index,
  items,
  onMove,
}: {
  canMove: boolean;
  index: number;
  items: ReadingQueueItemView[];
  onMove: (items: ReadingQueueItemView[]) => void;
}) {
  if (!canMove || index <= 0) return undefined;
  return () => onMove(swapItems(items, index, index - 1));
}

function swapItems(
  items: ReadingQueueItemView[],
  first: number,
  second: number,
): ReadingQueueItemView[] {
  const firstItem = items[first];
  const secondItem = items[second];
  if (firstItem === undefined || secondItem === undefined) return items;
  const next = [...items];
  next[first] = secondItem;
  next[second] = firstItem;
  return next;
}
