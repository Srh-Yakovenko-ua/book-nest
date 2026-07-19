import { z } from "zod";

import {
  CharacterGraphEdgeViewSchema,
  CharacterGraphModeSchema,
  CharacterGraphNodeViewSchema,
} from "./character-graph.js";
import { RelationshipCategorySchema, RelationshipTypeSchema } from "./character-relationships.js";
import { queryStringArray } from "./internal.js";

export const CHARACTER_PATH_MAX_VISITED_NODES = 5000;

export const CharacterRelationshipPathQuerySchema = z.object({
  categories: queryStringArray(RelationshipCategorySchema),
  contextBookId: z.uuid().optional(),
  fromId: z.uuid(),
  mode: CharacterGraphModeSchema.default("all"),
  relationshipTypes: queryStringArray(RelationshipTypeSchema),
  revealEdgeIds: queryStringArray(z.uuid()),
  toId: z.uuid(),
});

export type CharacterRelationshipPathQuery = z.infer<typeof CharacterRelationshipPathQuerySchema>;

export const CharacterRelationshipPathViewSchema = z.object({
  edges: z.array(CharacterGraphEdgeViewSchema),
  found: z.boolean(),
  fromId: z.uuid(),
  nodes: z.array(CharacterGraphNodeViewSchema),
  toId: z.uuid(),
});

export type CharacterRelationshipPathView = z.infer<typeof CharacterRelationshipPathViewSchema>;
