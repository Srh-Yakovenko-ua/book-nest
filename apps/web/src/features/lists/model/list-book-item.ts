import type { ListBookView } from "@app/shared";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import type { ListBookReorder } from "./list-reorder";
import type { ListBookDrag } from "./use-list-book-drag";

export type ListBookItemProps = {
  book: ListBookView;
  drag?: ListBookDrag;
  isPending: boolean;
  labels: LibraryBookLabels;
  onAddToQueue: () => void;
  onMove: (direction: "down" | "up") => void;
  onRemove: () => void;
  onStartReading: () => void;
  onToggleFavorite: () => void;
  reorder: ListBookReorder;
  selection?: ListBookSelection;
  showPosition: boolean;
};

export type ListBookSelection = {
  isSelected: boolean;
  onToggle: () => void;
};
