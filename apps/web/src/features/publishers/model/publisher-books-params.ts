import type { LibraryListParams } from "@/features/books";

export function publisherBooksListParams(
  publisherId: string,
  overrides?: Partial<LibraryListParams>,
): LibraryListParams {
  return {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    language: [],
    owner: [],
    publisher: [publisherId],
    status: [],
    tag: [],
    ...overrides,
  };
}
