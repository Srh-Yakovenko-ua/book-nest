import type { Nullable, TagColor, TagQuickFilter, TagSort, TagType } from "@app/shared";

import {
  TAG_COLORS,
  TAG_QUICK_FILTER_DEFAULT,
  TagQuickFilterSchema,
  TagsCatalogFacetsQuerySchema,
  TagSortSchema,
  TagTypeSchema,
} from "@app/shared";
import {
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export type TagsCatalogParams = TagsFacetsParams & {
  filter: TagQuickFilter;
  sort: TagSort;
};

export type TagsFacetsParams = {
  color?: TagColor[];
  q?: string;
  type?: TagType[];
};

export type TagsQueryState = inferParserType<typeof TAGS_QUERY_PARSERS>;

export type TagsStatePatch = {
  [Key in keyof TagsQueryState]?: Nullable<TagsQueryState[Key]>;
};

export type TagsViewMode = (typeof TAGS_QUERY.view.modes)[number];

export const TAGS_QUERY = {
  history: "push",
  search: {
    minLength: 2,
    schema: TagsCatalogFacetsQuerySchema.shape.q,
  },
  sort: {
    default: "created_desc" satisfies TagSort,
  },
  view: {
    default: "grid",
    modes: ["grid", "list"],
  },
} as const;

export const TAGS_QUERY_PARSERS = {
  color: parseAsArrayOf(parseAsStringLiteral(TAG_COLORS)).withDefault([]),
  filter: parseAsStringLiteral(TagQuickFilterSchema.options).withDefault(TAG_QUICK_FILTER_DEFAULT),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(TagSortSchema.options).withDefault(TAGS_QUERY.sort.default),
  type: parseAsArrayOf(parseAsStringLiteral(TagTypeSchema.options)).withDefault([]),
  view: parseAsStringLiteral(TAGS_QUERY.view.modes).withDefault(TAGS_QUERY.view.default),
};

export function clearAllTagsFiltersPatch(): TagsStatePatch {
  return { color: null, filter: null, q: null, type: null };
}

export function committedTagSearch(query: string): string {
  const parsed = TAGS_QUERY.search.schema.safeParse(normalizeTagSearch(query));
  if (!parsed.success || parsed.data === undefined) return "";
  return parsed.data.length >= TAGS_QUERY.search.minLength ? parsed.data : "";
}

export function hasActiveTagsFilters(state: TagsQueryState): boolean {
  return hasContextualTagCriteria(state) || state.filter !== TAG_QUICK_FILTER_DEFAULT;
}

export function hasContextualTagCriteria(state: TagsQueryState): boolean {
  return committedTagSearch(state.q) !== "" || state.type.length > 0 || state.color.length > 0;
}

export function toArrayPatch<TValue>(values: readonly TValue[]): Nullable<TValue[]> {
  const unique = [...new Set(values)];
  return unique.length === 0 ? null : unique;
}

export function toggleArrayValue<TValue>(values: readonly TValue[], value: TValue): TValue[] {
  const unique = [...new Set(values)];
  return unique.includes(value) ? unique.filter((item) => item !== value) : [...unique, value];
}

export function toTagsCatalogParams(state: TagsQueryState): TagsCatalogParams {
  return { ...toTagsFacetsParams(state), filter: state.filter, sort: state.sort };
}

export function toTagSearchPatch(query: string): TagsStatePatch {
  const search = committedTagSearch(query);
  return { q: search === "" ? null : search };
}

export function toTagsFacetsParams(state: TagsQueryState): TagsFacetsParams {
  const search = committedTagSearch(state.q);
  const type = [...new Set(state.type)];
  const color = [...new Set(state.color)];

  return {
    ...(search === "" ? {} : { q: search }),
    ...(type.length === 0 ? {} : { type }),
    ...(color.length === 0 ? {} : { color }),
  };
}

function normalizeTagSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
