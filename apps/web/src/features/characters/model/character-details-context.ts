import type { BookCharacterView, Nullable } from "@app/shared";

import { ApiError } from "@/lib/http-client";

import type { CharacterDetailsTab, CharacterRouteArgs } from "./character-routes";

import { CHARACTER_GLOBAL_VIEW, getCharacterDetailsPath } from "./character-routes";

export type CharacterDetailsMode =
  { bookId: string; kind: "book" } | { kind: "global" } | { kind: "smart" };

export type CharacterDetailsRequest = CharacterDetailsMode | { kind: "invalid-book" };

type CharacterDetailsLocation = CharacterDetailsSearch & {
  q: string;
  tab: CharacterDetailsTab;
};

type CharacterDetailsSearch = {
  bookId: Nullable<string>;
  view: Nullable<string>;
};

const UNAVAILABLE_CONTEXT_STATUSES: readonly number[] = [400, 403, 404];

export function canonicalCharacterDetailsHref({
  characterId,
  search,
}: {
  characterId: string;
  search: CharacterDetailsLocation;
}): Nullable<string> {
  const { bookId, q, tab, view } = search;
  if (view === null) return null;
  if (bookId !== null) return getCharacterDetailsPath({ bookId, characterId, q, tab });
  return view === CHARACTER_GLOBAL_VIEW ? null : getCharacterDetailsPath({ characterId, q, tab });
}

export function characterRouteArgsOf({
  characterId,
  mode,
}: {
  characterId: string;
  mode: CharacterDetailsMode;
}): CharacterRouteArgs {
  if (mode.kind === "book") return { bookId: mode.bookId, characterId };
  if (mode.kind === "global") return { characterId, view: CHARACTER_GLOBAL_VIEW };
  return { characterId };
}

export function isUnavailableContextError(error: unknown): boolean {
  return error instanceof ApiError && UNAVAILABLE_CONTEXT_STATUSES.includes(error.status);
}

export function resolveCharacterDetailsMode({
  appearances,
  request,
}: {
  appearances: readonly BookCharacterView[];
  request: CharacterDetailsMode;
}): Nullable<CharacterDetailsMode> {
  if (request.kind === "global") return request;
  if (request.kind === "book") {
    return appearances.some((appearance) => appearance.bookId === request.bookId) ? request : null;
  }
  const [onlyAppearance, ...otherAppearances] = appearances;
  if (onlyAppearance !== undefined && otherAppearances.length === 0) {
    return { bookId: onlyAppearance.bookId, kind: "book" };
  }
  return request;
}

export function resolveCharacterDetailsRequest({
  bookId,
  view,
}: CharacterDetailsSearch): CharacterDetailsRequest {
  if (bookId !== null) {
    return bookId.trim().length === 0 ? { kind: "invalid-book" } : { bookId, kind: "book" };
  }
  return view === CHARACTER_GLOBAL_VIEW ? { kind: "global" } : { kind: "smart" };
}
