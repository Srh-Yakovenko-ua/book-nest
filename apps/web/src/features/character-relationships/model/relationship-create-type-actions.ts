import type {
  CatalogRelationshipType,
  CharacterRelationshipCustomTypeView,
  RelationshipDirectionality,
} from "@app/shared";
import type { UseFormReturn } from "react-hook-form";

import { getRelationshipTypeCategory, normalizeName } from "@app/shared";
import { flushSync } from "react-dom";

import type { RelationshipFormInput, RelationshipFormValues } from "./relationship-form-schema";

export type RelationshipCustomTypeChoice = Pick<
  CharacterRelationshipCustomTypeView,
  "directionality" | "name"
>;

export function createRelationshipTypeActions({
  form,
  onOrientationReset,
}: {
  form: UseFormReturn<RelationshipFormInput, unknown, RelationshipFormValues>;
  onOrientationReset: () => void;
}) {
  const { clearErrors, getValues, setFocus, setValue } = form;

  return {
    changeCustomDirectionality(next: RelationshipDirectionality) {
      if (next === getValues("directionality")) return;
      onOrientationReset();
      setValue("directionality", next, { shouldDirty: true });
      clearErrors("directionality");
    },
    pickCustomType(choice: RelationshipCustomTypeChoice) {
      const [currentName, currentDirectionality] = getValues(["customType", "directionality"]);
      const isSameChoice =
        normalizeName(choice.name) === normalizeName(currentName) &&
        choice.directionality === currentDirectionality;
      if (!isSameChoice) onOrientationReset();
      setValue("customType", choice.name, { shouldDirty: true });
      setValue("directionality", choice.directionality, { shouldDirty: true });
      clearErrors(["customType", "directionality"]);
    },
    selectStandardType(next: CatalogRelationshipType) {
      if (next !== getValues("type")) onOrientationReset();
      setValue("type", next, { shouldDirty: true });
      setValue("category", getRelationshipTypeCategory(next), { shouldDirty: true });
      clearErrors(["type", "category", "customType"]);
    },
    startCustomType() {
      if (getValues("type") !== "custom") onOrientationReset();
      flushSync(() => {
        setValue("type", "custom", { shouldDirty: true });
        setValue("category", "custom", { shouldDirty: true });
      });
      clearErrors(["type", "category"]);
      setFocus("customType");
    },
  };
}
