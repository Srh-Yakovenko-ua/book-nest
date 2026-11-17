import type { CharacterGraphLayoutView, Nullable } from "@app/shared";

import {
  CharacterGraphLayoutScopeTypeSchema,
  CharacterGraphPositionsSchema,
  CharacterGraphStorageModeSchema,
  CharacterGraphViewportSchema,
} from "@app/shared";

export type CharacterGraphLayoutSource = {
  contextBookId: Nullable<string>;
  createdAt: Date;
  id: string;
  layoutVersion: string;
  mode: string;
  positions: unknown;
  scopeId: Nullable<string>;
  scopeType: string;
  updatedAt: Date;
  viewport: unknown;
};

export function toCharacterGraphLayoutView(
  layout: CharacterGraphLayoutSource,
): CharacterGraphLayoutView {
  return {
    contextBookId: layout.contextBookId,
    createdAt: layout.createdAt.toISOString(),
    id: layout.id,
    layoutVersion: layout.layoutVersion,
    mode: CharacterGraphStorageModeSchema.parse(layout.mode),
    positions: CharacterGraphPositionsSchema.parse(layout.positions),
    scopeId: layout.scopeId,
    scopeType: CharacterGraphLayoutScopeTypeSchema.parse(layout.scopeType),
    updatedAt: layout.updatedAt.toISOString(),
    viewport: layout.viewport === null ? null : CharacterGraphViewportSchema.parse(layout.viewport),
  };
}
