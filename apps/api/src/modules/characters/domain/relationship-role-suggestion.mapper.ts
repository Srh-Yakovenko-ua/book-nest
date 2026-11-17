import type { CharacterRelationshipRoleSuggestionView } from "@app/shared";

export type RelationshipRoleSuggestionSource = {
  id: string;
  label: string;
};

export function toRelationshipRoleSuggestionView(
  roleSuggestion: RelationshipRoleSuggestionSource,
): CharacterRelationshipRoleSuggestionView {
  return {
    id: roleSuggestion.id,
    label: roleSuggestion.label,
  };
}
