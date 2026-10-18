import type { Nullable } from "@app/shared";

export type BookNotesScrollAnchor = BookNotesScrollScope &
  NoteCardOffset & {
    neighbours: readonly NoteCardOffset[];
    scrollY: number;
  };

export type BookNotesScrollScope = {
  bookId: string;
  criteriaKey: string;
};

type NoteCard = {
  element: Element;
  noteId: string;
};

type NoteCardOffset = {
  noteId: string;
  offset: number;
};

type ScrollAnchorReading = {
  container: ParentNode;
  scope: BookNotesScrollScope;
  scrollY: number;
};

const BOOK_NOTES_SCROLL_ANCHOR = {
  cardAttribute: "data-note-id",
  neighbourReach: 3,
} as const;

export function captureBookNotesScrollAnchor({
  container,
  scope,
  scrollY,
}: ScrollAnchorReading): Nullable<BookNotesScrollAnchor> {
  const cards = renderedNoteCards(container);
  const anchorIndex = topmostVisibleCardIndex(cards);
  const anchorCard = cards[anchorIndex];
  if (anchorCard === undefined) return null;

  return {
    ...scope,
    ...toCardOffset(anchorCard),
    neighbours: nearestFirstIndexes(anchorIndex).flatMap((index) => {
      const card = cards[index];
      return card === undefined ? [] : [toCardOffset(card)];
    }),
    scrollY,
  };
}

export function resolveBookNotesScrollTop({
  anchor,
  container,
  scope,
  scrollY,
}: ScrollAnchorReading & { anchor: BookNotesScrollAnchor }): Nullable<number> {
  if (anchor.bookId !== scope.bookId || anchor.criteriaKey !== scope.criteriaKey) return null;

  const rendered = new Map(renderedNoteCards(container).map((card) => [card.noteId, card.element]));

  for (const candidate of [anchor, ...anchor.neighbours]) {
    const element = rendered.get(candidate.noteId);
    if (element !== undefined) {
      return scrollY + element.getBoundingClientRect().top - candidate.offset;
    }
  }

  return anchor.scrollY;
}

function nearestFirstIndexes(anchorIndex: number): number[] {
  return Array.from(
    { length: BOOK_NOTES_SCROLL_ANCHOR.neighbourReach },
    (_, step) => step + 1,
  ).flatMap((distance) => [anchorIndex + distance, anchorIndex - distance]);
}

function renderedNoteCards(container: ParentNode): NoteCard[] {
  return Array.from(
    container.querySelectorAll(`[${BOOK_NOTES_SCROLL_ANCHOR.cardAttribute}]`),
  ).flatMap((element) => {
    const noteId = element.getAttribute(BOOK_NOTES_SCROLL_ANCHOR.cardAttribute);
    return noteId === null ? [] : [{ element, noteId }];
  });
}

function toCardOffset(card: NoteCard): NoteCardOffset {
  return { noteId: card.noteId, offset: card.element.getBoundingClientRect().top };
}

function topmostVisibleCardIndex(cards: readonly NoteCard[]): number {
  const index = cards.findIndex((card) => card.element.getBoundingClientRect().bottom > 0);
  return index === -1 ? cards.length - 1 : index;
}
