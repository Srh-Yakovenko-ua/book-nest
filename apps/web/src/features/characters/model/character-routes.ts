export const CHARACTER_GLOBAL_VIEW = "global";

export const CHARACTER_DETAILS_TABS = ["overview", "facts"] as const;

export const CHARACTER_DETAILS_TAB_DEFAULT = "overview" satisfies CharacterDetailsTab;

export type CharacterDetailsTab = (typeof CHARACTER_DETAILS_TABS)[number];

export type CharacterRouteArgs =
  | { bookId?: string; characterId: string; view?: undefined }
  | { bookId?: undefined; characterId: string; view: typeof CHARACTER_GLOBAL_VIEW };

type CharacterDetailsRouteArgs = CharacterRouteArgs & {
  q?: string;
  tab?: CharacterDetailsTab;
};

export function getBookCharactersPath(bookId: string): string {
  return `/books/${bookId}?tab=characters`;
}

export function getCharacterDetailsPath(args: CharacterDetailsRouteArgs): string {
  const search = contextSearch(args);
  if (args.tab !== undefined && args.tab !== CHARACTER_DETAILS_TAB_DEFAULT) {
    search.set("tab", args.tab);
  }
  if (args.q !== undefined && args.q.length > 0) search.set("q", args.q);
  return `/characters/${args.characterId}${queryStringOf(search)}`;
}

export function getCharacterEditPath(args: CharacterRouteArgs): string {
  return `/characters/${args.characterId}/edit${queryStringOf(contextSearch(args))}`;
}

function contextSearch({ bookId, view }: CharacterRouteArgs): URLSearchParams {
  if (bookId !== undefined) return new URLSearchParams({ bookId });
  return new URLSearchParams(view === undefined ? {} : { view });
}

function queryStringOf(search: URLSearchParams): string {
  const query = search.toString();
  return query.length === 0 ? "" : `?${query}`;
}
