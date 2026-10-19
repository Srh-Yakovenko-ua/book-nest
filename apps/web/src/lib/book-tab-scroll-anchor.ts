import type { Nullable } from "@app/shared";

export type BookTabCardAttribute = `data-${string}-id`;

export type BookTabScrollAnchor = BookTabScrollScope &
  CardOffset & {
    neighbours: readonly CardOffset[];
    scrollY: number;
  };

export type BookTabScrollScope = {
  bookId: string;
  criteriaKey: string;
};

type CardOffset = {
  cardId: string;
  offset: number;
};

type RenderedCard = {
  cardId: string;
  element: Element;
};

type ScrollAnchorReading = {
  cardAttribute: BookTabCardAttribute;
  container: ParentNode;
  scope: BookTabScrollScope;
  scrollY: number;
};

const BOOK_TAB_SCROLL_ANCHOR = {
  neighbourReach: 3,
} as const;

export function captureBookTabScrollAnchor({
  cardAttribute,
  container,
  scope,
  scrollY,
}: ScrollAnchorReading): Nullable<BookTabScrollAnchor> {
  const cards = renderedCards(container, cardAttribute);
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

export function resolveBookTabScrollTop({
  anchor,
  cardAttribute,
  container,
  scope,
  scrollY,
}: ScrollAnchorReading & { anchor: BookTabScrollAnchor }): Nullable<number> {
  if (anchor.bookId !== scope.bookId || anchor.criteriaKey !== scope.criteriaKey) return null;

  const rendered = new Map(
    renderedCards(container, cardAttribute).map((card) => [card.cardId, card.element]),
  );

  for (const candidate of [anchor, ...anchor.neighbours]) {
    const element = rendered.get(candidate.cardId);
    if (element !== undefined) {
      return scrollY + element.getBoundingClientRect().top - candidate.offset;
    }
  }

  return anchor.scrollY;
}

function nearestFirstIndexes(anchorIndex: number): number[] {
  return Array.from(
    { length: BOOK_TAB_SCROLL_ANCHOR.neighbourReach },
    (_, step) => step + 1,
  ).flatMap((distance) => [anchorIndex + distance, anchorIndex - distance]);
}

function renderedCards(container: ParentNode, cardAttribute: BookTabCardAttribute): RenderedCard[] {
  return Array.from(container.querySelectorAll(`[${cardAttribute}]`)).flatMap((element) => {
    const cardId = element.getAttribute(cardAttribute);
    return cardId === null ? [] : [{ cardId, element }];
  });
}

function toCardOffset(card: RenderedCard): CardOffset {
  return { cardId: card.cardId, offset: card.element.getBoundingClientRect().top };
}

function topmostVisibleCardIndex(cards: readonly RenderedCard[]): number {
  const index = cards.findIndex((card) => card.element.getBoundingClientRect().bottom > 0);
  return index === -1 ? cards.length - 1 : index;
}
