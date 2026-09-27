import type { GenresOverviewView } from "@app/shared";

export function hasGenreInsights(overview: GenresOverviewView): boolean {
  return (
    overview.dormantGenres.length > 0 ||
    overview.newForYouGenres.length > 0 ||
    overview.unratedFinishedGenres.length > 0
  );
}
