import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BooksRepository } from "../infrastructure/books.repository.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";

export async function assertBookOwned({
  bookId,
  booksRepository,
  notFoundCode,
  userId,
}: {
  bookId: string;
  booksRepository: BooksRepository;
  notFoundCode?: string;
  userId: string;
}): Promise<void> {
  const owned = await booksRepository.existsOwned({ bookId, userId });
  if (!owned) {
    throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE, { code: notFoundCode });
  }
}
