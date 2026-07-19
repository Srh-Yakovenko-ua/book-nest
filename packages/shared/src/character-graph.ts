import { z } from "zod";

import {
  CharacterRelationshipDiagnosticViewSchema,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "./character-relationships.js";
import { BookCharacterImportanceSchema, CharacterEntityKindSchema } from "./characters.js";
import { queryStringArray } from "./internal.js";

export const CHARACTER_GRAPH_DEPTH_MIN = 1;
export const CHARACTER_GRAPH_DEPTH_MAX = 3;
export const CHARACTER_GRAPH_DEPTH_DEFAULT = 1;
export const CHARACTER_GRAPH_NODE_LIMIT = 300;
export const CHARACTER_GRAPH_EDGE_LIMIT = 600;

export const CharacterGraphModeSchema = z.enum(["family", "all"]);

export type CharacterGraphMode = z.infer<typeof CharacterGraphModeSchema>;

const characterGraphQueryFields = {
  categories: queryStringArray(RelationshipCategorySchema),
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

export const BookCharacterGraphQuerySchema = z.object(characterGraphQueryFields);

export type BookCharacterGraphQuery = z.infer<typeof BookCharacterGraphQuerySchema>;

export const SeriesCharacterGraphQuerySchema = z.object({
  ...characterGraphQueryFields,
  contextBookId: z.uuid().optional(),
});

export type SeriesCharacterGraphQuery = z.infer<typeof SeriesCharacterGraphQuerySchema>;

export const CharacterGraphNodeViewSchema = z.object({
  degree: z.number().int().nonnegative(),
  entityKind: CharacterEntityKindSchema,
  id: z.string(),
  importance: BookCharacterImportanceSchema.nullable(),
  isFavorite: z.boolean(),
  name: z.string(),
});

export type CharacterGraphNodeView = z.infer<typeof CharacterGraphNodeViewSchema>;

export const CharacterGraphEdgeViewSchema = z.object({
  category: RelationshipCategorySchema.nullable(),
  description: z.string().nullable(),
  descriptionHidden: z.boolean(),
  directionality: RelationshipDirectionalitySchema,
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
  hasHiddenNodes: z.boolean(),
  hasLockedEdges: z.boolean(),
  truncated: z.boolean(),
});

export type CharacterGraphHiddenContentView = z.infer<typeof CharacterGraphHiddenContentViewSchema>;

export const CharacterGraphViewSchema = z.object({
  diagnostics: z.array(CharacterRelationshipDiagnosticViewSchema),
  edges: z.array(CharacterGraphEdgeViewSchema),
  graphVersion: z.string(),
  hiddenContent: CharacterGraphHiddenContentViewSchema,
  mode: CharacterGraphModeSchema,
  nodes: z.array(CharacterGraphNodeViewSchema),
  updatedAt: z.string().nullable(),
});

export type CharacterGraphView = z.infer<typeof CharacterGraphViewSchema>;
