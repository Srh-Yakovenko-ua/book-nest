"use client";

import type {
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
} from "@app/shared";
import type { UseFormRegister } from "react-hook-form";

import { RelationshipCategorySchema, RelationshipDirectionalitySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

import { ChipGroup } from "@/components/ui/chip-group";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipFormInput,
} from "../model/relationship-form-schema";

import { resolveRelationshipDirectionality } from "../model/relationship-form-input";
import { RELATIONSHIP_FORM_LIMITS } from "../model/relationship-form-schema";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipSwitchField } from "./relationship-switch-field";
import { RelationshipTypePicker } from "./relationship-type-picker";

const TYPE_FIELD_IDS = {
  canonical: "relationship-canonical",
  category: "relationship-category",
  customType: "relationship-custom-type",
  customTypeError: "relationship-custom-type-error",
  directionality: "relationship-directionality",
  type: "relationship-type",
  typeError: "relationship-type-error",
} as const;

export type RelationshipCustomDirectionality =
  { kind: "choose" } | { kind: "fixed"; value: RelationshipDirectionality };

type RelationshipTypeFieldsProps = {
  control: RelationshipFormControl;
  customDirectionality: RelationshipCustomDirectionality;
  errors: RelationshipFormErrors;
  onCategoryChange: (category: RelationshipCategory) => void;
  register: UseFormRegister<RelationshipFormInput>;
};

export function RelationshipTypeFields({
  control,
  customDirectionality,
  errors,
  onCategoryChange,
  register,
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
          <Label htmlFor={TYPE_FIELD_IDS.customType}>{t("customLabel")}</Label>
          <Input
            aria-describedby={errors.customType ? TYPE_FIELD_IDS.customTypeError : undefined}
            aria-invalid={errors.customType !== undefined}
            aria-required
            autoComplete="off"
            className="h-10"
            data-relationship-autofocus=""
            id={TYPE_FIELD_IDS.customType}
            maxLength={RELATIONSHIP_FORM_LIMITS.customTypeMax}
            placeholder={t("customPlaceholder")}
            {...register("customType")}
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

      {isCustom && customDirectionality.kind === "choose" ? (
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{t("directionality")}</span>
          <Controller
            control={control}
            name="directionality"
            render={({ field }) => (
              <Segmented
                block
                label={t("directionality")}
                onValueChange={(next) => {
                  const parsed = RelationshipDirectionalitySchema.safeParse(next);
                  if (parsed.success) field.onChange(parsed.data);
                }}
                options={RelationshipDirectionalitySchema.options.map((option) => ({
                  label: labels.directionality(option),
                  value: option,
                }))}
                value={field.value}
              />
            )}
          />
        </div>
      ) : (
        <ReadOnlyDirectionality
          hint={isCustom ? t("directionalityLocked") : t("directionalityAuto")}
          value={displayedDirectionality({ customDirectionality, directionality, isCustom, type })}
        />
      )}

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
  customDirectionality: RelationshipCustomDirectionality;
  directionality: RelationshipDirectionality;
  isCustom: boolean;
  type: Nullable<RelationshipType>;
}): Nullable<RelationshipDirectionality> {
  if (isCustom && customDirectionality.kind === "fixed") return customDirectionality.value;
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
