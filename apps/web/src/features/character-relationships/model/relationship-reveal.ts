import type { Nullable } from "@app/shared";

import type { CharacterRelationshipsControllerGetByIdParams } from "@/shared/api/generated/model";

import { assertNever } from "@/lib/assert-never";

export type RelationshipReveal = {
  descriptionBookStateId: Nullable<string>;
  isTypeRevealed: boolean;
};

export type RelationshipRevealRequest =
  { bookStateId: string; bookTitle: string; kind: "description" } | { kind: "type" };

type RelationshipRevealParams = Pick<
  CharacterRelationshipsControllerGetByIdParams,
  "revealDescriptionBookStateId" | "revealType"
>;

export const RELATIONSHIP_NO_REVEAL = {
  descriptionBookStateId: null,
  isTypeRevealed: false,
} as const satisfies RelationshipReveal;

export function applyRelationshipRevealRequest({
  request,
  reveal,
}: {
  request: RelationshipRevealRequest;
  reveal: RelationshipReveal;
}): RelationshipReveal {
  switch (request.kind) {
    case "description":
      return { ...reveal, descriptionBookStateId: request.bookStateId };
    case "type":
      return { ...reveal, isTypeRevealed: true };
    default:
      return assertNever(request);
  }
}

export function hasRelationshipReveal(reveal: RelationshipReveal): boolean {
  return reveal.isTypeRevealed || reveal.descriptionBookStateId !== null;
}

export function toRelationshipRevealParams(reveal: RelationshipReveal): RelationshipRevealParams {
  return {
    ...(reveal.isTypeRevealed ? { revealType: "true" } : {}),
    ...(reveal.descriptionBookStateId === null
      ? {}
      : { revealDescriptionBookStateId: reveal.descriptionBookStateId }),
  };
}
