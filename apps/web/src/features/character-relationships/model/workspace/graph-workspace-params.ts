import {
  CHARACTER_GRAPH_DEPTH_DEFAULT,
  CHARACTER_GRAPH_DEPTH_MAX,
  CHARACTER_GRAPH_DEPTH_MIN,
  FAMILY_TREE_GENERATIONS,
  type Nullable,
  RELATIONSHIP_CATEGORY_TYPES,
  type RelationshipCategory,
  RelationshipCategorySchema,
  type RelationshipType,
  RelationshipTypeSchema,
} from "@app/shared";
import {
  createParser,
  createSerializer,
  type inferParserType,
  parseAsArrayOf,
  parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

export const GRAPH_WORKSPACE_VIEWS = ["person", "tree", "network"] as const;

export const NETWORK_GROUPINGS = ["group", "components", "importance"] as const;

export type GraphWorkspaceParams = inferParserType<typeof graphWorkspaceParsers>;

export type GraphWorkspaceView = (typeof GRAPH_WORKSPACE_VIEWS)[number];

export type NetworkGrouping = (typeof NETWORK_GROUPINGS)[number];

const UuidSchema = z.uuid();

const parseAsUuid = createParser({
  parse: (value: string) => (UuidSchema.safeParse(value).success ? value.toLowerCase() : null),
  serialize: (value: string) => value,
});

const parseAsPathFlag = createParser<boolean>({
  parse: (value: string) => (value === "1" ? true : null),
  serialize: () => "1",
});

function parseAsBoundedInteger({ max, min }: { max: number; min: number }) {
  return createParser({
    parse: (value: string) => {
      if (!/^\d+$/.test(value)) return null;
      const parsed = Number.parseInt(value, 10);
      return parsed >= min && parsed <= max ? parsed : null;
    },
    serialize: (value: number) => String(value),
  });
}

const generationsParser = parseAsBoundedInteger({
  max: FAMILY_TREE_GENERATIONS.max,
  min: FAMILY_TREE_GENERATIONS.min,
}).withDefault(FAMILY_TREE_GENERATIONS.default);

export const graphWorkspaceParsers = {
  categories: parseAsArrayOf(parseAsStringLiteral(RelationshipCategorySchema.options)).withDefault(
    [],
  ),
  characterId: parseAsUuid,
  depth: parseAsBoundedInteger({
    max: CHARACTER_GRAPH_DEPTH_MAX,
    min: CHARACTER_GRAPH_DEPTH_MIN,
  }).withDefault(CHARACTER_GRAPH_DEPTH_DEFAULT),
  from: parseAsUuid,
  networkGroup: parseAsStringLiteral(NETWORK_GROUPINGS).withDefault("group"),
  path: parseAsPathFlag.withDefault(false),
  to: parseAsUuid,
  treeDown: generationsParser,
  treeUp: generationsParser,
  types: parseAsArrayOf(parseAsStringLiteral(RelationshipTypeSchema.options)).withDefault([]),
  view: parseAsStringLiteral(GRAPH_WORKSPACE_VIEWS).withDefault("person"),
};

const serializeGraphWorkspaceParams = createSerializer(graphWorkspaceParsers);

export const GRAPH_WORKSPACE_FILTERS_RESET = {
  categories: [],
  types: [],
} satisfies Pick<GraphWorkspaceParams, "categories" | "types">;

export function canonicalizeGraphWorkspaceParams(
  params: GraphWorkspaceParams,
): GraphWorkspaceParams {
  const filters = normalizeGraphWorkspaceFilters({
    categories: params.categories,
    types: params.types,
  });
  return {
    ...params,
    ...filters,
    from: params.path ? params.from : null,
    to: params.path ? params.to : null,
  };
}

export function countGraphWorkspaceFilters(
  params: Pick<GraphWorkspaceParams, "categories" | "types">,
): number {
  return params.categories.length + params.types.length;
}

export function needsGraphWorkspaceCanonicalReplace({
  canonical,
  search,
}: {
  canonical: GraphWorkspaceParams;
  search: URLSearchParams;
}): boolean {
  const expected = new URLSearchParams(serializeGraphWorkspaceParams(canonical));
  return Object.keys(graphWorkspaceParsers).some(
    (key) => (search.get(key) ?? null) !== (expected.get(key) ?? null),
  );
}

export function normalizeGraphWorkspaceFilters({
  categories,
  types,
}: {
  categories: readonly RelationshipCategory[];
  types: readonly RelationshipType[];
}): { categories: RelationshipCategory[]; types: RelationshipType[] } {
  const selectedCategories = RelationshipCategorySchema.options.filter((category) =>
    categories.includes(category),
  );
  const allowedTypes = toAllowedGraphWorkspaceTypes(selectedCategories);
  const selectedTypes = RelationshipTypeSchema.options.filter(
    (type) => types.includes(type) && (allowedTypes === null || allowedTypes.has(type)),
  );
  return { categories: selectedCategories, types: selectedTypes };
}

export function toAllowedGraphWorkspaceTypes(
  categories: readonly RelationshipCategory[],
): Nullable<ReadonlySet<RelationshipType>> {
  if (categories.length === 0) return null;
  return new Set(categories.flatMap((category) => RELATIONSHIP_CATEGORY_TYPES[category]));
}
