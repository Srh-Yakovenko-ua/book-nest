"use client";

import type { Nullable, RelationshipBookStateStatus } from "@app/shared";
import type { Ref } from "react";
import type { UseFormRegister } from "react-hook-form";

import { RelationshipBookStateStatusSchema, RelationshipIntensitySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { ChipGroup } from "@/components/ui/chip-group";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { RelationshipCreateSemantics } from "../model/relationship-create-semantics";
import type { RelationshipCreateSection } from "../model/relationship-create-step";
import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipFormInput,
} from "../model/relationship-form-schema";

import { RELATIONSHIP_FORM_LIMITS } from "../model/relationship-form-schema";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipCreateBookSummary } from "./relationship-create-book-summary";
import { RelationshipCreatePositionsSection } from "./relationship-create-positions-section";
import { RelationshipCreateSpoilersSection } from "./relationship-create-spoilers-section";

const CREATE_BOOK_STATE_FIELDS = {
  noIntensity: "none",
} as const;

type RelationshipCreateBookStateStepProps = {
  bookTitle: Nullable<string>;
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  headingRef: Ref<HTMLHeadingElement>;
  onSectionOpenChange: (section: RelationshipCreateSection, open: boolean) => void;
  onStatusEnded: () => void;
  register: UseFormRegister<RelationshipFormInput>;
  sections: Record<RelationshipCreateSection, boolean>;
  semantics: Nullable<RelationshipCreateSemantics>;
};

type StatusHintKey = "endedWithoutPositionHint" | "statusHint";

export function RelationshipCreateBookStateStep({
  bookTitle,
  control,
  errors,
  headingRef,
  onSectionOpenChange,
  onStatusEnded,
  register,
  sections,
  semantics,
}: RelationshipCreateBookStateStepProps) {
  const t = useTranslations("relationships.editor.state");
  const labels = useRelationshipLabels();
  const fieldsId = useId();
  const ids = {
    description: `${fieldsId}-description`,
    descriptionCounter: `${fieldsId}-description-counter`,
    descriptionError: `${fieldsId}-description-error`,
  };
  const [status, description, endedChapter, endedPage, endedAudio] = useWatch({
    control,
    name: [
      "bookState.status",
      "bookState.description",
      "bookState.endedChapter",
      "bookState.endedPage",
      "bookState.endedAudio",
    ],
  });
  const hasEndedPosition =
    endedChapter.trim() !== "" || endedPage !== null || endedAudio.trim() !== "";
  const descriptionError = errors.bookState?.description;
  const descriptionDescribedBy = [
    ids.descriptionCounter,
    ...(descriptionError === undefined ? [] : [ids.descriptionError]),
  ].join(" ");
  const statusHint = toStatusHint({ hasEndedPosition, status });

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <RelationshipCreateBookSummary
        bookTitle={bookTitle}
        headingRef={headingRef}
        semantics={semantics}
      />

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
                if (!parsed.success) return;
                if (parsed.data === "ended" && field.value !== "ended") onStatusEnded();
                field.onChange(parsed.data);
              }}
              options={RelationshipBookStateStatusSchema.options.map((option) => ({
                label: labels.status(option),
                value: option,
              }))}
              size="sm"
              value={field.value}
            />
          )}
        />
        <p className="text-xs text-muted-foreground empty:-mt-2" role="status">
          {statusHint === null ? null : t(statusHint)}
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
                if (next === CREATE_BOOK_STATE_FIELDS.noIntensity) {
                  field.onChange(null);
                  return;
                }
                const parsed = RelationshipIntensitySchema.safeParse(next);
                if (parsed.success) field.onChange(parsed.data);
              }}
              options={[
                { label: t("intensityNone"), value: CREATE_BOOK_STATE_FIELDS.noIntensity },
                ...RelationshipIntensitySchema.options.map((option) => ({
                  label: labels.intensity(option),
                  value: option,
                })),
              ]}
              size="sm"
              value={field.value ?? CREATE_BOOK_STATE_FIELDS.noIntensity}
            />
          )}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={ids.description}>
          {t("description")}{" "}
          <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Textarea
          aria-describedby={descriptionDescribedBy}
          aria-invalid={descriptionError !== undefined}
          className="min-h-20"
          id={ids.description}
          maxLength={RELATIONSHIP_FORM_LIMITS.descriptionMax}
          placeholder={t("descriptionPlaceholder")}
          {...register("bookState.description")}
        />
        <div className="flex min-w-0 items-start justify-between gap-3">
          <FieldError error={descriptionError} id={ids.descriptionError} />
          <p
            className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
            id={ids.descriptionCounter}
          >
            {t("descriptionCounter", {
              count: description.length,
              max: RELATIONSHIP_FORM_LIMITS.descriptionMax,
            })}
          </p>
        </div>
      </div>

      <RelationshipCreatePositionsSection
        control={control}
        errors={errors}
        onOpenChange={(open) => onSectionOpenChange("positions", open)}
        open={sections.positions}
        register={register}
      />
      <RelationshipCreateSpoilersSection
        control={control}
        errors={errors}
        onOpenChange={(open) => onSectionOpenChange("spoilers", open)}
        open={sections.spoilers}
      />
    </div>
  );
}

function toStatusHint({
  hasEndedPosition,
  status,
}: {
  hasEndedPosition: boolean;
  status: RelationshipBookStateStatus;
}): Nullable<StatusHintKey> {
  if (status === "hidden") return "statusHint";
  if (status === "ended" && !hasEndedPosition) return "endedWithoutPositionHint";
  return null;
}
