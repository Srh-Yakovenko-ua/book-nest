export function getBookCharactersListPath(bookId: string): string {
  return `/books/${bookId}?tab=characters&charactersView=list`;
}

export function getBookGraphWorkspacePath(bookId: string): string {
  return `/books/${bookId}/characters/graph`;
}
