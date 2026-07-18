import { parseAsStringLiteral } from "nuqs";

export type GenresTagsTab = "genres" | "tags";

export const GENRES_TAGS_TABS = ["genres", "tags"] as const satisfies readonly GenresTagsTab[];

export const GENRES_TAGS_TAB_DEFAULT: GenresTagsTab = "genres";

export const genresTagsTabParser =
  parseAsStringLiteral(GENRES_TAGS_TABS).withDefault(GENRES_TAGS_TAB_DEFAULT);
