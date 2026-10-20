import type { CharacterAppearanceBook } from "./characters.js";
import type { Nullable } from "./common.js";

export type CharacterBookOrderKey = Pick<CharacterAppearanceBook, "id" | "series" | "title">;

type CharacterBookSeries = NonNullable<CharacterBookOrderKey["series"]>;

const CHARACTER_BOOK_TEXT_COLLATOR = new Intl.Collator("uk", {
  sensitivity: "variant",
  usage: "sort",
});

export function compareCharacterBooks(
  left: CharacterBookOrderKey,
  right: CharacterBookOrderKey,
): number {
  const leftSeries = left.series;
  const rightSeries = right.series;
  if (leftSeries === null || rightSeries === null) {
    if (leftSeries !== rightSeries) return leftSeries === null ? 1 : -1;
    return compareByTitleThenId(left, right);
  }
  if (leftSeries.id !== rightSeries.id) return compareSeries(leftSeries, rightSeries);
  return (
    comparePartNumbers(leftSeries.partNumber, rightSeries.partNumber) ||
    compareByTitleThenId(left, right)
  );
}

function compareByTitleThenId(left: CharacterBookOrderKey, right: CharacterBookOrderKey): number {
  return compareText(left.title, right.title) || compareCodeUnits(left.id, right.id);
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function comparePartNumbers(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function compareSeries(left: CharacterBookSeries, right: CharacterBookSeries): number {
  return compareText(left.name, right.name) || compareCodeUnits(left.id, right.id);
}

function compareText(left: string, right: string): number {
  return CHARACTER_BOOK_TEXT_COLLATOR.compare(left, right) || compareCodeUnits(left, right);
}
