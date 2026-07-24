import { PaginatedCharacterSummarySchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import { bookCharactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type BookCharactersPage = z.infer<typeof PaginatedCharacterSummarySchema>;

export function useBookCharacters(bookId: string, params: BookCharactersControllerListParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookCharactersPage> =>
      PaginatedCharacterSummarySchema.parse(await bookCharactersControllerList(bookId, params)),
    queryKey: characterKeys.bookRoster(bookId, params),
  });
}
