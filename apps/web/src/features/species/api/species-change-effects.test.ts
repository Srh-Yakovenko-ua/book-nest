import type { QueryKey } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { characterKeys } from "@/features/characters/api/character-keys";

import { speciesChangeEffects } from "./species-change-effects";
import { speciesKeys } from "./species-keys";

const KEYS = {
  bookList: ["/api/books", "list", { page: 1 }],
  characters: characterKeys.overview(),
  species: speciesKeys.own({}),
} as const satisfies Record<string, QueryKey>;

describe("speciesChangeEffects", () => {
  it.each(["renamed", "merged", "deleted"] as const)(
    "refreshes species and characters but not books after a species is %s",
    async (change) => {
      const keys = [KEYS.species, KEYS.characters, KEYS.bookList];
      const client = new QueryClient();
      for (const key of keys) client.setQueryData(key, {});

      await speciesChangeEffects.speciesChanged(client, { change });

      expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([
        true,
        true,
        false,
      ]);
    },
  );
});
