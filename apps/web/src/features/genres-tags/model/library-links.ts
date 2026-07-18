const LIBRARY_PATH = "/books";

export function genreLibraryHref(genreKey: string): string {
  return `${LIBRARY_PATH}?${new URLSearchParams({ genre: genreKey }).toString()}`;
}

export function tagLibraryHref(tagId: string): string {
  return `${LIBRARY_PATH}?${new URLSearchParams({ tag: tagId }).toString()}`;
}
