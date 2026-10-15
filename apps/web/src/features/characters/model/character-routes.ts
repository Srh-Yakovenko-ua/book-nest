export const CHARACTER_GLOBAL_VIEW = "global";

export type CharacterRouteArgs =
  | { bookId?: string; characterId: string; view?: undefined }
  | { bookId?: undefined; characterId: string; view: typeof CHARACTER_GLOBAL_VIEW };

export function getBookCharactersPath(bookId: string): string {
  return `/books/${bookId}?tab=characters`;
}

export function getCharacterDetailsPath(args: CharacterRouteArgs): string {
  return `/characters/${args.characterId}${contextQuery(args)}`;
}

export function getCharacterEditPath(args: CharacterRouteArgs): string {
  return `/characters/${args.characterId}/edit${contextQuery(args)}`;
}

function contextQuery({ bookId, view }: CharacterRouteArgs): string {
  if (bookId !== undefined) return `?bookId=${encodeURIComponent(bookId)}`;
  return view === undefined ? "" : `?view=${view}`;
}
