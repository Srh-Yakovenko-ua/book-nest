export type RelationshipAction = (relationshipId: string) => void;

export type RelationshipActions = {
  onDelete?: RelationshipAction;
  onEdit?: RelationshipAction;
};

export type RelationshipBookOption = {
  id: string;
  title: string;
};

export function hasRelationshipActions(actions: RelationshipActions): boolean {
  return actions.onDelete !== undefined || actions.onEdit !== undefined;
}
