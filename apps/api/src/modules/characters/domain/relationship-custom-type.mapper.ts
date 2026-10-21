import type { CharacterRelationshipCustomTypeView } from "@app/shared";

import { RelationshipDirectionalitySchema } from "@app/shared";

export type RelationshipCustomTypeSource = {
  directionality: string;
  id: string;
  name: string;
};

export function toRelationshipCustomTypeView(
  customType: RelationshipCustomTypeSource,
): CharacterRelationshipCustomTypeView {
  return {
    directionality: RelationshipDirectionalitySchema.parse(customType.directionality),
    id: customType.id,
    name: customType.name,
  };
}
