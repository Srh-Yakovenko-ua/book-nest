import { createLogger } from "../../../core/logger.js";
import { type SeriesBookRow } from "../infrastructure/characters.repository.js";

const log = createLogger("characters");

export function warnOnAmbiguousSeriesOrder({
  seriesBooks,
  seriesId,
}: {
  seriesBooks: SeriesBookRow[];
  seriesId: string;
}): void {
  const missingPartNumber = seriesBooks.filter((book) => book.partNumber === null).length;
  const partNumbers = seriesBooks
    .map((book) => book.partNumber)
    .filter((partNumber): partNumber is number => partNumber !== null);
  const hasDuplicatePartNumbers = new Set(partNumbers).size !== partNumbers.length;
  if (missingPartNumber > 0 || hasDuplicatePartNumbers) {
    log.warn(
      { hasDuplicatePartNumbers, missingPartNumber, seriesId },
      "series has ambiguous book ordering; character context masking uses a conservative fallback",
    );
  }
}
