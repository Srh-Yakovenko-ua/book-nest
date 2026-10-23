import { z } from "zod";

import { CharacterGroupTypeSchema } from "./character-groups.js";
import {
  CharacterRelationshipDiagnosticViewSchema,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "./character-relationships.js";
import { BookCharacterImportanceSchema, CharacterEntityKindSchema } from "./characters.js";
import { readingPositionQueryFields } from "./common.js";
import { queryStringArray } from "./internal.js";
import { MediaViewSchema } from "./media.js";

export const CHARACTER_GRAPH_DEPTH_MIN = 1;
export const CHARACTER_GRAPH_DEPTH_MAX = 3;
export const CHARACTER_GRAPH_DEPTH_DEFAULT = 1;
export const CHARACTER_GRAPH_NODE_LIMIT = 300;
export const CHARACTER_GRAPH_EDGE_LIMIT = 600;

export const FAMILY_TREE_GENERATIONS = {
  default: 2,
  max: 3,
  min: 1,
} as const;

export const CharacterGraphModeSchema = z.enum(["family", "all"]);

export type CharacterGraphMode = z.infer<typeof CharacterGraphModeSchema>;

export const CharacterGraphClusterBySchema = z.enum(["group", "importance"]);

export type CharacterGraphClusterBy = z.infer<typeof CharacterGraphClusterBySchema>;

const characterGraphQueryFields = {
  ...readingPositionQueryFields,
  categories: queryStringArray(RelationshipCategorySchema),
  clusterBy: CharacterGraphClusterBySchema.optional(),
  depth: z.coerce
    .number()
    .int()
    .min(CHARACTER_GRAPH_DEPTH_MIN)
    .max(CHARACTER_GRAPH_DEPTH_MAX)
    .default(CHARACTER_GRAPH_DEPTH_DEFAULT),
  focusCharacterId: z.uuid().optional(),
  mode: CharacterGraphModeSchema.default("all"),
  relationshipTypes: queryStringArray(RelationshipTypeSchema),
  revealEdgeIds: queryStringArray(z.uuid()),
};

export const CharacterGraphProjectionSchema = z.literal("family_tree");

export type CharacterGraphProjection = z.infer<typeof CharacterGraphProjectionSchema>;

const familyTreeGenerationsField = z.coerce
  .number()
  .int()
  .min(FAMILY_TREE_GENERATIONS.min)
  .max(FAMILY_TREE_GENERATIONS.max)
  .optional();

export const BookCharacterGraphQuerySchema = z
  .object({
    ...characterGraphQueryFields,
    ancestors: familyTreeGenerationsField,
    descendants: familyTreeGenerationsField,
    projection: CharacterGraphProjectionSchema.optional(),
  })
  .superRefine((query, ctx) => {
    if (query.projection === undefined) {
      if (query.ancestors !== undefined || query.descendants !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "ancestors and descendants require projection=family_tree",
          path: ["projection"],
        });
      }
      return;
    }
    if (query.focusCharacterId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "focusCharacterId is required for projection=family_tree",
        path: ["focusCharacterId"],
      });
    }
    const combinesGraphFilters =
      query.mode !== "all" ||
      query.clusterBy !== undefined ||
      (query.categories?.length ?? 0) > 0 ||
      (query.relationshipTypes?.length ?? 0) > 0;
    if (combinesGraphFilters) {
      ctx.addIssue({
        code: "custom",
        message: "projection=family_tree cannot be combined with graph filters or clustering",
        path: ["projection"],
      });
    }
  });

export type BookCharacterGraphQuery = z.infer<typeof BookCharacterGraphQuerySchema>;

export const SeriesCharacterGraphQuerySchema = z
  .object({
    ...characterGraphQueryFields,
    contextBookId: z.uuid().optional(),
  })
  .strict();

export type SeriesCharacterGraphQuery = z.infer<typeof SeriesCharacterGraphQuerySchema>;

export const CharacterGraphNodeViewSchema = z.object({
  clusterId: z.string().nullable(),
  degree: z.number().int().nonnegative(),
  displayMedia: MediaViewSchema.nullable(),
  displayName: z.string(),
  entityKind: CharacterEntityKindSchema,
  id: z.string(),
  importance: BookCharacterImportanceSchema.nullable(),
  isFavorite: z.boolean(),
  name: z.string(),
});

export type CharacterGraphNodeView = z.infer<typeof CharacterGraphNodeViewSchema>;

export const CharacterGraphGroupClusterViewSchema = z.object({
  groupType: CharacterGroupTypeSchema,
  id: z.string(),
  kind: z.literal("group"),
  name: z.string().nullable(),
  size: z.number().int().positive(),
});

export const CharacterGraphImportanceClusterViewSchema = z.object({
  id: z.string(),
  importance: BookCharacterImportanceSchema,
  kind: z.literal("importance"),
  size: z.number().int().positive(),
});

export const CharacterGraphClusterViewSchema = z.discriminatedUnion("kind", [
  CharacterGraphGroupClusterViewSchema,
  CharacterGraphImportanceClusterViewSchema,
]);

export type CharacterGraphClusterView = z.infer<typeof CharacterGraphClusterViewSchema>;

export const CharacterGraphEdgeViewSchema = z.object({
  category: RelationshipCategorySchema.nullable(),
  description: z.string().nullable(),
  descriptionHidden: z.boolean(),
  directionality: RelationshipDirectionalitySchema.nullable(),
  id: z.string(),
  intensity: RelationshipIntensitySchema.nullable(),
  revealed: z.boolean(),
  source: z.string(),
  sourceLabel: z.string().nullable(),
  status: RelationshipBookStateStatusSchema.nullable(),
  target: z.string(),
  targetLabel: z.string().nullable(),
  type: RelationshipTypeSchema.nullable(),
  typeHidden: z.boolean(),
});

export type CharacterGraphEdgeView = z.infer<typeof CharacterGraphEdgeViewSchema>;

export const CharacterGraphHiddenContentViewSchema = z.object({
  hasHiddenEdges: z.boolean(),
  hasLockedEdges: z.boolean(),
  truncated: z.boolean(),
});

export type CharacterGraphHiddenContentView = z.infer<typeof CharacterGraphHiddenContentViewSchema>;

export const CharacterGraphViewSchema = z.object({
  clusterBy: CharacterGraphClusterBySchema.nullable(),
  clusters: z.array(CharacterGraphClusterViewSchema),
  diagnostics: z.array(CharacterRelationshipDiagnosticViewSchema),
  edges: z.array(CharacterGraphEdgeViewSchema),
  graphVersion: z.string(),
  hiddenContent: CharacterGraphHiddenContentViewSchema,
  mode: CharacterGraphModeSchema,
  nodes: z.array(CharacterGraphNodeViewSchema),
  updatedAt: z.string().nullable(),
});

export type CharacterGraphView = z.infer<typeof CharacterGraphViewSchema>;

export const FamilyTreeLineageKindSchema = z.enum(["biological", "adoptive", "step"]);

export type FamilyTreeLineageKind = z.infer<typeof FamilyTreeLineageKindSchema>;

export const FamilyTreeLineageViewSchema = z.object({
  childId: z.uuid(),
  kind: FamilyTreeLineageKindSchema,
  parentId: z.uuid(),
  relationshipId: z.uuid(),
});

export type FamilyTreeLineageView = z.infer<typeof FamilyTreeLineageViewSchema>;

const familyTreeGenerationsView = z
  .number()
  .int()
  .min(FAMILY_TREE_GENERATIONS.min)
  .max(FAMILY_TREE_GENERATIONS.max);

export const FamilyTreeGraphViewSchema = z.object({
  ancestors: familyTreeGenerationsView,
  descendants: familyTreeGenerationsView,
  diagnostics: z.array(CharacterRelationshipDiagnosticViewSchema),
  edges: z.array(CharacterGraphEdgeViewSchema),
  focusCharacterId: z.uuid(),
  graphVersion: z.string(),
  hiddenContent: CharacterGraphHiddenContentViewSchema,
  lineage: z.array(FamilyTreeLineageViewSchema),
  nodes: z.array(CharacterGraphNodeViewSchema),
  projection: CharacterGraphProjectionSchema,
  updatedAt: z.string().nullable(),
});

export type FamilyTreeGraphView = z.infer<typeof FamilyTreeGraphViewSchema>;
