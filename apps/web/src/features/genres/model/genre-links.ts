const GENRE_LIBRARY_LINKS = {
  path: "/books",
  unratedFinished: { hasRating: "false", status: "finished" },
} as const;

export function genreLibraryHref(genreKey: string): string {
  return libraryHref({ genre: genreKey });
}

export function unratedFinishedLibraryHref(genreKey: string): string {
  return libraryHref({ genre: genreKey, ...GENRE_LIBRARY_LINKS.unratedFinished });
}

function libraryHref(params: Record<string, string>): string {
  return `${GENRE_LIBRARY_LINKS.path}?${new URLSearchParams(params).toString()}`;
}
