"use client";

import { useGenres } from "@/features/books/api/use-genres";

export function useGenreName(): (genreKey: string) => string {
  const genres = useGenres();
  const nameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  return (genreKey) => nameByKey.get(genreKey) ?? genreKey;
}
