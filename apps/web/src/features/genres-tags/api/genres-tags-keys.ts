const GENRES_ROOT = "/api/genres";
const TAGS_ROOT = "/api/tags";

export const genresTagsKeys = {
  genreCatalog: [GENRES_ROOT] as const,
  genreStats: [GENRES_ROOT, "stats"] as const,
  tagStats: [TAGS_ROOT, "stats"] as const,
};
