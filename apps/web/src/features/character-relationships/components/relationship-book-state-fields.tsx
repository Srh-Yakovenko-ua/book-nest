"use client";

import type { UseFormRegister } from "react-hook-form";

import { RelationshipBookStateStatusSchema, RelationshipIntensitySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { ChipGroup } from "@/components/ui/chip-group";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipFormInput,
} from "../model/relationship-form-schema";

import { RELATIONSHIP_FORM_LIMITS } from "../model/relationship-form-schema";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipPositionFields } from "./relationship-position-fields";
import { RelationshipSwitchField } from "./relationship-switch-field";

const BOOK_STATE_FIELD = {
  description: "relationship-state-description",
  descriptionError: "relationship-state-description-error",
  descriptionSpoiler: "relationship-state-description-spoiler",
  hideRelationship: "relationship-state-hide-relationship",
  noIntensity: "none",
  statusHint: "relationship-state-status-hint",
  typeSpoiler: "relationship-state-type-spoiler",
} as const;

type RelationshipBookStateFieldsProps = {
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  register: UseFormRegister<RelationshipFormInput>;
};

export function RelationshipBookStateFields({
  control,
  errors,
  register,
}: RelationshipBookStateFieldsProps) {
  const t = useTranslations("relationships.editor.state");
  const tSpoilers = useTranslations("relationships.editor.spoilers");
  const labels = useRelationshipLabels();
  const descriptionError = errors.bookState?.description;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{t("status")}</span>
        <Controller
          control={control}
          name="bookState.status"
          render={({ field }) => (
            <ChipGroup
              label={t("status")}
              mode="single"
              onValueChange={(next) => {
                const parsed = RelationshipBookStateStatusSchema.safeParse(next);
                if (parsed.success) field.onChange(parsed.data);
              }}
              options={RelationshipBookStateStatusSchema.options.map((status) => ({
                label: labels.status(status),
                value: status,
              }))}
              size="sm"
              value={field.value}
            />
          )}
        />
        <p className="text-xs text-muted-foreground" id={BOOK_STATE_FIELD.statusHint}>
          {t("statusHint")}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{t("intensity")}</span>
        <Controller
          control={control}
          name="bookState.intensity"
          render={({ field }) => (
            <ChipGroup
              label={t("intensity")}
              mode="single"
              onValueChange={(next) => {
                if (next === BOOK_STATE_FIELD.noIntensity) {
                  field.onChange(null);
                  return;
                }
                const parsed = RelationshipIntensitySchema.safeParse(next);
                if (parsed.success) field.onChange(parsed.data);
              }}
              options={[
                { label: t("intensityNone"), value: BOOK_STATE_FIELD.noIntensity },
                ...RelationshipIntensitySchema.options.map((intensity) => ({
                  label: labels.intensity(intensity),
                  value: intensity,
                })),
              ]}
              size="sm"
              value={field.value ?? BOOK_STATE_FIELD.noIntensity}
            />
          )}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={BOOK_STATE_FIELD.description}>{t("description")}</Label>
        <Textarea
          aria-describedby={descriptionError ? BOOK_STATE_FIELD.descriptionError : undefined}
          aria-invalid={descriptionError !== undefined}
          className="min-h-24"
          id={BOOK_STATE_FIELD.description}
          maxLength={RELATIONSHIP_FORM_LIMITS.descriptionMax}
          placeholder={t("descriptionPlaceholder")}
          {...register("bookState.description")}
        />
        <FieldError error={descriptionError} id={BOOK_STATE_FIELD.descriptionError} />
      </div>

      <RelationshipPositionFields
        control={control}
        edge="introduced"
        errors={errors}
        register={register}
      />
      <RelationshipPositionFields
        control={control}
        edge="ended"
        errors={errors}
        register={register}
      />

      <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-foreground">{tSpoilers("heading")}</legend>
        <p className="text-xs text-muted-foreground">{tSpoilers("hint")}</p>
        <RelationshipSwitchField
          control={control}
          description={tSpoilers("typeHint")}
          id={BOOK_STATE_FIELD.typeSpoiler}
          label={tSpoilers("type")}
          name="bookState.isTypeSpoiler"
        />
        <RelationshipSwitchField
          control={control}
          description={tSpoilers("descriptionHint")}
          id={BOOK_STATE_FIELD.descriptionSpoiler}
          label={tSpoilers("description")}
          name="bookState.isDescriptionSpoiler"
        />
        <RelationshipSwitchField
          control={control}
          description={tSpoilers("relationshipHint")}
          id={BOOK_STATE_FIELD.hideRelationship}
          label={tSpoilers("relationship")}
          name="bookState.hideRelationshipAsSpoiler"
        />
      </fieldset>
    </div>
  );
}
