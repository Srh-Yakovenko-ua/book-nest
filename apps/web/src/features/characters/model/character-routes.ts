type CharacterRouteArgs = {
  bookId?: string;
  characterId: string;
};

export function getBookCharactersPath(bookId: string): string {
  return `/books/${bookId}?tab=characters`;
}

export function getCharacterDetailsPath({ bookId, characterId }: CharacterRouteArgs): string {
  return `/characters/${characterId}${bookQuery(bookId)}`;
}

export function getCharacterEditPath({ bookId, characterId }: CharacterRouteArgs): string {
  return `/characters/${characterId}/edit${bookQuery(bookId)}`;
}

function bookQuery(bookId: string | undefined): string {
  return bookId === undefined ? "" : `?bookId=${encodeURIComponent(bookId)}`;
}
