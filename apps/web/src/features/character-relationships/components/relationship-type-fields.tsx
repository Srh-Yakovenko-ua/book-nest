"use client";

import type {
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
} from "@app/shared";

import { RelationshipCategorySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

import { ChipGroup } from "@/components/ui/chip-group";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
} from "../model/relationship-form-schema";

import { resolveRelationshipDirectionality } from "../model/relationship-form-input";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipCustomTypeCombobox } from "./relationship-custom-type-combobox";
import { RelationshipSwitchField } from "./relationship-switch-field";
import { RelationshipTypePicker } from "./relationship-type-picker";

const TYPE_FIELD_IDS = {
  canonical: "relationship-canonical",
  category: "relationship-category",
  customTypeError: "relationship-custom-type-error",
  directionality: "relationship-directionality",
  type: "relationship-type",
  typeError: "relationship-type-error",
} as const;

type RelationshipTypeFieldsProps = {
  control: RelationshipFormControl;
  customDirectionality: RelationshipDirectionality;
  errors: RelationshipFormErrors;
  onCategoryChange: (category: RelationshipCategory) => void;
};

export function RelationshipTypeFields({
  control,
  customDirectionality,
  errors,
  onCategoryChange,
}: RelationshipTypeFieldsProps) {
  const t = useTranslations("relationships.editor.type");
  const labels = useRelationshipLabels();
  const [category, type, directionality] = useWatch({
    control,
    name: ["category", "type", "directionality"],
  });
  const isCustom = category === "custom";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium text-foreground" id={TYPE_FIELD_IDS.category}>
          {t("category")}
        </span>
        <ChipGroup
          label={t("category")}
          mode="single"
          onValueChange={(next) => {
            const parsed = RelationshipCategorySchema.safeParse(next);
            if (parsed.success) onCategoryChange(parsed.data);
          }}
          options={RelationshipCategorySchema.options.map((option) => ({
            label: labels.category(option),
            value: option,
          }))}
          size="sm"
          value={category}
        />
      </div>

      {isCustom ? (
        <div className="flex min-w-0 flex-col gap-2">
          <span aria-hidden className="text-sm font-medium text-foreground">
            {t("customLabel")}
          </span>
          <Controller
            control={control}
            name="customType"
            render={({ field }) => (
              <RelationshipCustomTypeCombobox
                describedBy={errors.customType ? TYPE_FIELD_IDS.customTypeError : undefined}
                directionality={customDirectionality}
                invalid={errors.customType !== undefined}
                label={t("customLabel")}
                onBlur={field.onBlur}
                onChange={field.onChange}
                onPick={(choice) => field.onChange(choice.name)}
                ref={field.ref}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.customType} id={TYPE_FIELD_IDS.customTypeError} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={TYPE_FIELD_IDS.type}>{t("label")}</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RelationshipTypePicker
                category={category}
                describedBy={errors.type ? TYPE_FIELD_IDS.typeError : undefined}
                id={TYPE_FIELD_IDS.type}
                invalid={errors.type !== undefined}
                onBlur={field.onBlur}
                onChange={field.onChange}
                ref={field.ref}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.type} id={TYPE_FIELD_IDS.typeError} />
        </div>
      )}

      <ReadOnlyDirectionality
        hint={isCustom ? t("directionalityLocked") : t("directionalityAuto")}
        value={displayedDirectionality({ customDirectionality, directionality, isCustom, type })}
      />

      <RelationshipSwitchField
        control={control}
        description={t("canonicalHint")}
        id={TYPE_FIELD_IDS.canonical}
        label={t("canonical")}
        name="isCanonical"
      />
    </div>
  );
}

function displayedDirectionality({
  customDirectionality,
  directionality,
  isCustom,
  type,
}: {
  customDirectionality: RelationshipDirectionality;
  directionality: RelationshipDirectionality;
  isCustom: boolean;
  type: Nullable<RelationshipType>;
}): Nullable<RelationshipDirectionality> {
  if (isCustom) return customDirectionality;
  if (type === null) return null;
  return resolveRelationshipDirectionality({ directionality, type });
}

function ReadOnlyDirectionality({
  hint,
  value,
}: {
  hint: string;
  value: Nullable<RelationshipDirectionality>;
}) {
  const t = useTranslations("relationships.editor.type");
  const labels = useRelationshipLabels();

  return (
    <div className="flex min-w-0 flex-col gap-1" id={TYPE_FIELD_IDS.directionality}>
      <span className="text-sm font-medium text-foreground">{t("directionality")}</span>
      <p className="text-sm text-foreground">
        {value === null ? t("directionalityPending") : labels.directionality(value)}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
