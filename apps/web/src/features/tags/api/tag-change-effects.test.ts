import type { QueryKey } from "@tanstack/react-query";

import { describe, expect, it } from "vitest";

import { characterKeys } from "@/features/characters/api/character-keys";
import { genresKeys } from "@/features/genres/api/genres-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { seededClient, staleFlags } from "@/test-query-cache";

import { tagChangeEffects } from "./tag-change-effects";
import { tagsKeys } from "./tags-keys";

const KEYS = {
  bookList: ["/api/books", "list", { page: 1 }],
  catalog: tagsKeys.catalog({ filter: "all", sort: "usage_count_desc" }),
  characters: characterKeys.overview(),
  facets: tagsKeys.facets({}),
  genres: genresKeys.summary,
  picker: tagsKeys.picker(""),
  selected: tagsKeys.selected(["tag-1"]),
  series: seriesKeys.overview,
  summary: tagsKeys.summary,
} as const satisfies Record<string, QueryKey>;

describe("tagChangeEffects", () => {
  it.each(["created", "updated", "deleted"] as const)(
    "refreshes tag aggregates and pickers after a tag is %s",
    async (change) => {
      const keys = [KEYS.catalog, KEYS.facets, KEYS.summary, KEYS.picker, KEYS.selected];
      const client = seededClient(keys);

      await tagChangeEffects.tagsChanged(client, { change });

      expect(staleFlags(client, keys)).toEqual([true, true, true, true, true]);
    },
  );

  it("leaves books, characters and series alone after a tag is created", async () => {
    const keys = [KEYS.catalog, KEYS.bookList, KEYS.characters, KEYS.series];
    const client = seededClient(keys);

    await tagChangeEffects.tagsChanged(client, { change: "created" });

    expect(staleFlags(client, keys)).toEqual([true, false, false, false]);
  });

  it.each(["updated", "deleted"] as const)(
    "refreshes books, characters and series after a tag is %s",
    async (change) => {
      const keys = [KEYS.bookList, KEYS.characters, KEYS.series];
      const client = seededClient(keys);

      await tagChangeEffects.tagsChanged(client, { change });

      expect(staleFlags(client, keys)).toEqual([true, true, true]);
    },
  );

  it.each(["created", "updated", "deleted"] as const)(
    "leaves genres alone after a tag is %s",
    async (change) => {
      const keys = [KEYS.catalog, KEYS.genres];
      const client = seededClient(keys);

      await tagChangeEffects.tagsChanged(client, { change });

      expect(staleFlags(client, keys)).toEqual([true, false]);
    },
  );
});
