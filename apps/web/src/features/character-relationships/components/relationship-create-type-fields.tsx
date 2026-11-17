"use client";

import type { CatalogRelationshipType, RelationshipDirectionality } from "@app/shared";

import { RelationshipDirectionalitySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";

import type { RelationshipCustomTypeChoice } from "../model/relationship-create-type-actions";
import type {
  RelationshipFormControl,
  RelationshipFormErrors,
} from "../model/relationship-form-schema";

import { RelationshipCustomTypeCombobox } from "./relationship-custom-type-combobox";
import { RelationshipTypeSearchPicker } from "./relationship-type-search-picker";

const CREATE_TYPE_FIELDS = {
  directionalityOrder: [
    "symmetric",
    "directed",
  ] as const satisfies readonly RelationshipDirectionality[],
  ids: {
    customTypeError: "relationship-custom-type-error",
    directionality: "relationship-custom-directionality",
    type: "relationship-type",
    typeError: "relationship-type-error",
  },
} as const;

type RelationshipCreateTypeFieldsProps = {
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  onCustomDirectionalityChange: (directionality: RelationshipDirectionality) => void;
  onCustomTypeCommit: (name: string) => void;
  onCustomTypePick: (choice: RelationshipCustomTypeChoice) => void;
  onCustomTypeStart: () => void;
  onStandardTypeChange: (type: CatalogRelationshipType) => void;
};

export function RelationshipCreateTypeFields({
  control,
  errors,
  onCustomDirectionalityChange,
  onCustomTypeCommit,
  onCustomTypePick,
  onCustomTypeStart,
  onStandardTypeChange,
}: RelationshipCreateTypeFieldsProps) {
  const t = useTranslations("relationships.editor.type");
  const tCustom = useTranslations("relationships.editor.customType");
  const type = useWatch({ control, name: "type" });
  const { ids } = CREATE_TYPE_FIELDS;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={ids.type}>{t("label")}</Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RelationshipTypeSearchPicker
              describedBy={errors.type ? ids.typeError : undefined}
              id={ids.type}
              invalid={errors.type !== undefined}
              onBlur={field.onBlur}
              onCustomTypeStart={onCustomTypeStart}
              onTypeChange={onStandardTypeChange}
              ref={field.ref}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.type} id={ids.typeError} />
      </div>

      {type === "custom" ? (
        <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-3">
          <div className="flex min-w-0 flex-col gap-2">
            <span aria-hidden className="text-sm font-medium text-foreground">
              {t("customLabel")}
            </span>
            <Controller
              control={control}
              name="customType"
              render={({ field }) => (
                <RelationshipCustomTypeCombobox
                  describedBy={errors.customType ? ids.customTypeError : undefined}
                  invalid={errors.customType !== undefined}
                  label={t("customLabel")}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  onCommit={onCustomTypeCommit}
                  onPick={onCustomTypePick}
                  ref={field.ref}
                  value={field.value}
                />
              )}
            />
            <FieldError error={errors.customType} id={ids.customTypeError} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-medium text-foreground" id={ids.directionality}>
              {t("directionality")}
            </span>
            <Controller
              control={control}
              name="directionality"
              render={({ field }) => (
                <Segmented
                  block
                  className="*:text-center *:whitespace-normal"
                  label={t("directionality")}
                  onValueChange={(next) => {
                    const parsed = RelationshipDirectionalitySchema.safeParse(next);
                    if (parsed.success) onCustomDirectionalityChange(parsed.data);
                  }}
                  options={CREATE_TYPE_FIELDS.directionalityOrder.map((option) => ({
                    label: tCustom(option),
                    value: option,
                  }))}
                  value={field.value}
                />
              )}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
