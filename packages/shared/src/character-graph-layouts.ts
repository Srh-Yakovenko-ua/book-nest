import { z } from "zod";

import { CHARACTER_GRAPH_NODE_LIMIT } from "./character-graph.js";

const LAYOUT_VERSION_MAX = 200;
const LAYOUT_COORDINATE_ABS_MAX = 1_000_000;
const LAYOUT_ZOOM_MIN = 0.01;
const LAYOUT_ZOOM_MAX = 100;

const LAYOUT_VIRTUAL_NODE_KEY = {
  maxLength: 128,
  pattern: /^cluster:(?:group|components|importance):[a-z0-9_-]{1,96}$/,
} as const;

export const CHARACTER_GRAPH_LAYOUT_POSITIONS_MAX = CHARACTER_GRAPH_NODE_LIMIT;

export const CHARACTER_GRAPH_LAYOUT_ERROR_CODES = {
  bookNotFound: "character_graph_layout_book_not_found",
  notFound: "character_graph_layout_not_found",
  seriesNotFound: "character_graph_layout_series_not_found",
  validationFailed: "validation_failed",
} as const;

export const CharacterGraphLayoutScopeTypeSchema = z.enum(["book", "series", "global"]);

export type CharacterGraphLayoutScopeType = z.infer<typeof CharacterGraphLayoutScopeTypeSchema>;

export const CharacterGraphStorageModeSchema = z.enum([
  "family",
  "all",
  "person",
  "tree",
  "network",
]);

export type CharacterGraphStorageMode = z.infer<typeof CharacterGraphStorageModeSchema>;

const GRAPH_WORKSPACE_STORAGE_MODES: readonly CharacterGraphStorageMode[] = [
  "person",
  "tree",
  "network",
];

const coordinate = z
  .number()
  .finite()
  .min(-LAYOUT_COORDINATE_ABS_MAX)
  .max(LAYOUT_COORDINATE_ABS_MAX);

export const CharacterGraphNodePositionSchema = z.object({ x: coordinate, y: coordinate }).strict();

export type CharacterGraphNodePosition = z.infer<typeof CharacterGraphNodePositionSchema>;

const CharacterGraphPositionKeySchema = z.union([
  z.uuid(),
  z.string().max(LAYOUT_VIRTUAL_NODE_KEY.maxLength).regex(LAYOUT_VIRTUAL_NODE_KEY.pattern),
]);

export const CharacterGraphPositionsSchema = z
  .record(CharacterGraphPositionKeySchema, CharacterGraphNodePositionSchema)
  .refine((positions) => Object.keys(positions).length <= CHARACTER_GRAPH_LAYOUT_POSITIONS_MAX, {
    message: `positions may not exceed ${CHARACTER_GRAPH_LAYOUT_POSITIONS_MAX} entries`,
  });

export type CharacterGraphPositions = z.infer<typeof CharacterGraphPositionsSchema>;

export const CharacterGraphViewportSchema = z
  .object({
    x: coordinate,
    y: coordinate,
    zoom: z.number().finite().min(LAYOUT_ZOOM_MIN).max(LAYOUT_ZOOM_MAX),
  })
  .strict();

export type CharacterGraphViewport = z.infer<typeof CharacterGraphViewportSchema>;

const layoutKeyFields = {
  contextBookId: z.uuid().nullish(),
  mode: CharacterGraphStorageModeSchema,
  scopeId: z.uuid().nullish(),
  scopeType: CharacterGraphLayoutScopeTypeSchema,
};

const requireScopeConsistency = (
  value: {
    contextBookId?: null | string;
    mode: CharacterGraphStorageMode;
    scopeId?: null | string;
    scopeType: CharacterGraphLayoutScopeType;
  },
  ctx: z.RefinementCtx,
): void => {
  const isWorkspaceMode = GRAPH_WORKSPACE_STORAGE_MODES.includes(value.mode);
  const hasContextBookId = value.contextBookId !== null && value.contextBookId !== undefined;
  if (isWorkspaceMode && (value.scopeType !== "book" || hasContextBookId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "person, tree and network layouts belong to a book scope without contextBookId",
      path: ["mode"],
    });
  }
  const hasScopeId = value.scopeId !== null && value.scopeId !== undefined;
  if (value.scopeType === "global") {
    if (hasScopeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId must be omitted when scopeType is global",
        path: ["scopeId"],
      });
    }
    return;
  }
  if (!hasScopeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scopeId is required when scopeType is book or series",
      path: ["scopeId"],
    });
  }
};

export const CharacterGraphLayoutKeyQuerySchema = z
  .object(layoutKeyFields)
  .strict()
  .superRefine(requireScopeConsistency);

export type CharacterGraphLayoutKeyQuery = z.infer<typeof CharacterGraphLayoutKeyQuerySchema>;

export const SaveCharacterGraphLayoutSchema = z
  .object({
    ...layoutKeyFields,
    layoutVersion: z.string().trim().min(1).max(LAYOUT_VERSION_MAX),
    positions: CharacterGraphPositionsSchema,
    viewport: CharacterGraphViewportSchema.nullish(),
  })
  .strict()
  .superRefine(requireScopeConsistency);

export type SaveCharacterGraphLayout = z.infer<typeof SaveCharacterGraphLayoutSchema>;

export const CharacterGraphLayoutViewSchema = z.object({
  contextBookId: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  layoutVersion: z.string(),
  mode: CharacterGraphStorageModeSchema,
  positions: CharacterGraphPositionsSchema,
  scopeId: z.string().nullable(),
  scopeType: CharacterGraphLayoutScopeTypeSchema,
  updatedAt: z.string(),
  viewport: CharacterGraphViewportSchema.nullable(),
});

export type CharacterGraphLayoutView = z.infer<typeof CharacterGraphLayoutViewSchema>;
