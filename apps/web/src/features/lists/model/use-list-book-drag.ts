"use client";

import type { Nullable } from "@app/shared";
import type { DragEvent, HTMLAttributes } from "react";

import { useState } from "react";

export type ListBookDrag = {
  containerProps: HTMLAttributes<HTMLElement>;
  handleProps: HTMLAttributes<HTMLElement>;
  isDragged: boolean;
  isDropTarget: boolean;
};

type DraggableListBook = {
  id: string;
  position: number;
};

export function useListBookDrag({
  onDropAt,
}: {
  onDropAt: (input: { bookId: string; position: number }) => void;
}): (book: DraggableListBook) => ListBookDrag {
  const [dragged, setDragged] = useState<Nullable<DraggableListBook>>(null);
  const [overId, setOverId] = useState<Nullable<string>>(null);

  function reset() {
    setDragged(null);
    setOverId(null);
  }

  return (book) => ({
    containerProps: {
      onDragEnter: () => {
        if (dragged === null) return;
        setOverId(book.id);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setOverId((current) => (current === book.id ? null : current));
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged === null) return;
        event.preventDefault();
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const source = dragged;
        reset();
        if (source === null || source.id === book.id) return;
        onDropAt({ bookId: source.id, position: book.position });
      },
    },
    handleProps: {
      draggable: true,
      onDragEnd: reset,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", book.id);
        setDragged(book);
      },
    },
    isDragged: dragged?.id === book.id,
    isDropTarget: dragged !== null && dragged.id !== book.id && overId === book.id,
  });
}
