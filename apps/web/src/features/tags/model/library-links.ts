const LIBRARY_PATH = "/books";

export function tagLibraryHref(tagId: string): string {
  return `${LIBRARY_PATH}?${new URLSearchParams({ tag: tagId }).toString()}`;
}
